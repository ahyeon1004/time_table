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
    var day: SchoolDay? = nil
    var message: String? = nil
}

struct SchoolProvider: AppIntentTimelineProvider {
    private let setupMessage = "위젯을 우클릭해 연결 코드를 입력해 주세요."

    func placeholder(in context: Context) -> SchoolEntry {
        SchoolEntry(date: Date(), message: "시간표 불러오는 중")
    }

    func snapshot(for configuration: SchoolConfiguration, in context: Context) async -> SchoolEntry {
        let now = Date()
        let code = connectionCode(configuration)
        guard !context.isPreview, !code.isEmpty else {
            return SchoolEntry(date: now, message: setupMessage)
        }
        return SchoolEntry(date: now, day: cachedDay(for: code, date: now), message: "시간표 불러오는 중")
    }

    func timeline(for configuration: SchoolConfiguration, in context: Context) async -> Timeline<SchoolEntry> {
        let now = Date()
        let code = connectionCode(configuration)
        guard !code.isEmpty else {
            return Timeline(entries: [SchoolEntry(date: now, message: setupMessage)], policy: .never)
        }

        let calendar = SchoolClock.calendar
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let followingMidnight = calendar.date(byAdding: .day, value: 1, to: midnight)!
        let key = cacheKey(for: code)

        async let todayResult = fetchDay(for: code, date: now)
        async let tomorrowResult = fetchDay(for: code, date: midnight)
        let (today, tomorrow) = await (todayResult, tomorrowResult)

        for result in [today, tomorrow] {
            if case .failure(let error) = result, (error as? URLError)?.code == .userAuthenticationRequired {
                UserDefaults.standard.removeObject(forKey: key)
                let entry = SchoolEntry(date: now, message: "연결이 해제됐어요. 로그인 후 새 코드를 입력해 주세요.")
                return Timeline(entries: [entry], policy: .never)
            }
        }

        let liveDay = try? today.get()
        let nextDay = try? tomorrow.get()
        let day = liveDay ?? cachedDay(for: code, date: now)
        if let liveDay, let encoded = try? JSONEncoder().encode(liveDay) {
            UserDefaults.standard.set(encoded, forKey: key)
        }

        let message = liveDay != nil ? nil : day != nil ? "연결 안 됨 · 저장된 오늘 시간표" : "서버 연결을 확인해 주세요."
        let initial = SchoolEntry(date: now, day: day, message: message)
        var entries = [initial] + lessonEntries(after: initial)
        let tomorrowDay = nextDay.flatMap { candidate -> SchoolDay? in
            guard let liveDay, liveDay.grade == candidate.grade, liveDay.classroom == candidate.classroom else { return nil }
            return candidate
        }
        let next = SchoolEntry(date: midnight, day: tomorrowDay, message: tomorrowDay == nil ? "새 시간표 불러오는 중" : nil)
        entries += [next] + lessonEntries(after: next)
        entries.append(SchoolEntry(date: followingMidnight, message: "새 시간표 불러오는 중"))

        let refreshInterval: TimeInterval = liveDay == nil ? 15 * 60 : 30 * 60
        return Timeline(entries: entries, policy: .after(min(midnight, now.addingTimeInterval(refreshInterval))))
    }

    private func lessonEntries(after entry: SchoolEntry) -> [SchoolEntry] {
        guard let day = entry.day else { return [] }
        let times = Set(day.lessons.flatMap { lesson -> [Date] in
            let start = SchoolClock.instant(day: day.date, time: lesson.start)
            let end = SchoolClock.instant(day: day.date, time: lesson.end)
            return [start?.addingTimeInterval(-300), start, end].compactMap { $0 }
        })
        return times.filter { $0 > entry.date }.sorted().map {
            SchoolEntry(date: $0, day: day, message: entry.message)
        }
    }

    private func fetchDay(for code: String, date: Date) async -> Result<SchoolDay, Error> {
        do { return .success(try await SchoolAPI.loadAccount(code: code, now: date)) }
        catch { return .failure(error) }
    }

    private func connectionCode(_ configuration: SchoolConfiguration) -> String {
        configuration.accountCode.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func cacheKey(for code: String) -> String {
        "account:" + SHA256.hash(data: Data(code.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func cachedDay(for code: String, date: Date) -> SchoolDay? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey(for: code)),
              let day = try? JSONDecoder().decode(SchoolDay.self, from: data),
              day.date == SchoolClock.dayKey(date) else { return nil }
        return day
    }
}

struct SchoolWidgetView: View {
    let entry: SchoolEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) private var colorScheme
    var body: some View {
        TimetableCard(day: entry.day, date: entry.date, grade: entry.day?.grade ?? "–", classroom: entry.day?.classroom ?? "–", message: entry.message, large: family == .systemLarge, compact: family == .systemSmall)
            .unredacted()
            .containerBackground(for: .widget) {
                colorScheme == .dark
                    ? Color(red: 0.10, green: 0.13, blue: 0.19)
                    : Color(red: 0.97, green: 0.98, blue: 1)
            }
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
