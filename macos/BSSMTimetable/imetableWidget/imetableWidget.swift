import CryptoKit
import CoreText
import WidgetKit
import SwiftUI
import AppIntents

struct SchoolConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "나의 시간표" }
    static var description: IntentDescription { "시간표 앱에서 로그인하고 만든 위젯 연결 코드를 입력하세요." }
    @Parameter(title: "위젯 연결 코드", default: "") var accountCode: String
}
struct SchoolEntry: TimelineEntry {
    let date: Date
    let configuration: SchoolConfiguration
    let day: SchoolDay?
    let message: String?
}
struct SchoolProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SchoolEntry {
        SchoolEntry(date: Date(), configuration: SchoolConfiguration(), day: nil, message: "시간표 불러오는 중")
    }
    func snapshot(for configuration: SchoolConfiguration, in context: Context) async -> SchoolEntry { await entry(configuration) }
    func timeline(for configuration: SchoolConfiguration, in context: Context) async -> Timeline<SchoolEntry> {
        let initial = await entry(configuration)
        let now = initial.date
        var times = [now]
        if let day = initial.day {
            times += day.lessons.flatMap { [SchoolClock.instant(day: day.date, time: $0.start)?.addingTimeInterval(-300), SchoolClock.instant(day: day.date, time: $0.start), SchoolClock.instant(day: day.date, time: $0.end)].compactMap { $0 }.filter { $0 > now } }
        }
        let entries = times.sorted().map { SchoolEntry(date: $0, configuration: configuration, day: initial.day, message: initial.message) }
        let midnight = SchoolClock.calendar.startOfDay(for: SchoolClock.calendar.date(byAdding: .day, value: 1, to: now)!)
        return Timeline(entries: entries, policy: .after(min(midnight, now.addingTimeInterval(15 * 60))))
    }
    private func entry(_ configuration: SchoolConfiguration) async -> SchoolEntry {
        let now = Date()
        let code = configuration.accountCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return SchoolEntry(date: now, configuration: configuration, day: nil, message: "로그인 후 위젯 연결 코드를 입력해 주세요.") }
        let key = "account:" + SHA256.hash(data: Data(code.utf8)).map { String(format: "%02x", $0) }.joined()
        do {
            let day = try await SchoolAPI.loadAccount(code: code, now: now)
            if let encoded = try? JSONEncoder().encode(day) { UserDefaults.standard.set(encoded, forKey: key) }
            return SchoolEntry(date: now, configuration: configuration, day: day, message: nil)
        } catch {
            if (error as? URLError)?.code == .userAuthenticationRequired {
                UserDefaults.standard.removeObject(forKey: key)
                return SchoolEntry(date: now, configuration: configuration, day: nil, message: "연결이 해제됐어요. 로그인 후 새 코드를 입력해 주세요.")
            }
            let cached = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(SchoolDay.self, from: $0) }
            return SchoolEntry(date: now, configuration: configuration, day: cached?.date == SchoolClock.dayKey(now) ? cached : nil, message: cached?.date == SchoolClock.dayKey(now) ? "연결 안 됨 · 저장된 오늘 시간표" : "서버 연결을 확인해 주세요.")
        }
    }
}
struct SchoolWidgetView: View {
    let entry: SchoolEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        TimetableCard(day: entry.day, date: entry.date, grade: entry.day?.grade ?? "–", classroom: entry.day?.classroom ?? "–", message: entry.message, large: family == .systemLarge, compact: family == .systemSmall)
            .containerBackground(for: .widget) { Color(red: 0.97, green: 0.98, blue: 1) }
            .widgetURL(URL(string: entry.day == nil ? "https://bssm-timetable.vercel.app/#/notifications" : "https://bssm-timetable.vercel.app/#/dashboard"))
    }
}
struct imetableWidget: Widget {
    init() {
        for name in ["GmarketSansTTFMedium", "GmarketSansTTFBold"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts") ?? Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
    let kind = "imetableWidget"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SchoolConfiguration.self, provider: SchoolProvider()) { SchoolWidgetView(entry: $0) }
            .configurationDisplayName("시간표")
            .description("오늘 수업과 다음 수업을 확인하세요.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
