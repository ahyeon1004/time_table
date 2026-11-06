import CoreText
import WidgetKit
import SwiftUI
import AppIntents

enum GradeOption: String, AppEnum {
    case first = "1", second = "2", third = "3"
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "학년" }
    static var caseDisplayRepresentations: [GradeOption: DisplayRepresentation] { [.first: "1학년", .second: "2학년", .third: "3학년"] }
}
enum ClassOption: String, AppEnum {
    case one = "1", two = "2", three = "3", four = "4"
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "반" }
    static var caseDisplayRepresentations: [ClassOption: DisplayRepresentation] { [.one: "1반", .two: "2반", .three: "3반", .four: "4반"] }
}
struct SchoolConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "나의 시간표" }
    static var description: IntentDescription { "학년과 반을 선택해 주세요." }
    @Parameter(title: "학년", default: .first) var grade: GradeOption
    @Parameter(title: "반", default: .one) var classroom: ClassOption
    var serverAddress: String { "https://bssm-timetable.vercel.app" }
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
        guard let origin = SchoolAPI.origin(configuration.serverAddress) else { return SchoolEntry(date: now, configuration: configuration, day: nil, message: "위젯을 편집해 서버 주소를 확인해 주세요.") }
        let key = "cache:\(origin):\(configuration.grade.rawValue):\(configuration.classroom.rawValue)"
        do {
            let day = try await SchoolAPI.load(origin: origin, grade: configuration.grade.rawValue, classroom: configuration.classroom.rawValue, now: now)
            if let encoded = try? JSONEncoder().encode(day) { UserDefaults.standard.set(encoded, forKey: key) }
            return SchoolEntry(date: now, configuration: configuration, day: day, message: nil)
        } catch {
            let cached = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(SchoolDay.self, from: $0) }
            return SchoolEntry(date: now, configuration: configuration, day: cached?.date == SchoolClock.dayKey(now) ? cached : nil, message: cached?.date == SchoolClock.dayKey(now) ? "연결 안 됨 · 저장된 오늘 시간표" : "서버 연결을 확인해 주세요.")
        }
    }
}
struct SchoolWidgetView: View {
    let entry: SchoolEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        TimetableCard(day: entry.day, date: entry.date, grade: entry.configuration.grade.rawValue, classroom: entry.configuration.classroom.rawValue, message: entry.message, large: family == .systemLarge, compact: family == .systemSmall)
            .containerBackground(for: .widget) { Color(red: 0.97, green: 0.98, blue: 1) }
            .widgetURL(URL(string: "https://bssm-timetable.vercel.app/#/dashboard"))
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
