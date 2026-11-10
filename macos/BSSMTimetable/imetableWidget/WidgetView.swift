import SwiftUI
import WidgetKit

struct TimetableCard: View {
    let day: SchoolDay?
    let date: Date
    let grade: String
    let classroom: String
    let message: String?
    let large: Bool
    let compact: Bool
    @Environment(\.colorScheme) private var colorScheme
    private var blue: Color {
        colorScheme == .dark
            ? Color(red: 0.64, green: 0.78, blue: 1)
            : Color(red: 0.23, green: 0.41, blue: 0.67)
    }
    private var badgeText: Color {
        colorScheme == .dark ? Color(red: 0.10, green: 0.13, blue: 0.19) : .white
    }
    private var current: SchoolLesson? { day?.lessons.first { lesson in
        guard let start = SchoolClock.instant(day: day!.date, time: lesson.start), let end = SchoolClock.instant(day: day!.date, time: lesson.end) else { return false }
        return start <= date && date < end
    } }
    private var upcoming: [SchoolLesson] { day?.lessons.filter { (SchoolClock.instant(day: day!.date, time: $0.end) ?? .distantPast) > date } ?? [] }
    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            HStack {
                Label("시간표", systemImage: "calendar")
                    .font(.custom("GmarketSansTTFMedium", size: 13))
                    .foregroundStyle(blue)
                Spacer()
                Text("\(grade)-\(classroom)").font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
            }
            if day == nil {
                Spacer(minLength: 0)
                Text(message ?? "시간표를 연결해 주세요.").font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            } else if day!.lessons.isEmpty {
                Spacer(minLength: 0)
                Text("오늘은 등록된\n수업이 없어요.").font(.system(size: 15, weight: .medium))
                Spacer(minLength: 0)
            } else if compact {
                if let lesson = current ?? upcoming.first {
                    Text(current == nil ? ((SchoolClock.instant(day: day!.date, time: lesson.start)!.timeIntervalSince(date) <= 300) ? "곧 시작 · \(lesson.start)" : "다음 수업 · \(lesson.start)") : "지금 · \(lesson.period)교시")
                        .font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
                    Text(lesson.name).font(.custom("GmarketSansTTFBold", size: 18)).lineLimit(2).minimumScaleFactor(0.8)
                    Text(lesson.teacher.map { "\($0) 선생님" } ?? "교사 정보 미제공").font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                    Spacer(minLength: 0)
                } else {
                    Spacer(minLength: 0)
                    Text("오늘 수업 끝!").font(.custom("GmarketSansTTFMedium", size: 17))
                    Spacer(minLength: 0)
                }
            } else {
                let lessons = large ? day!.lessons : Array((upcoming.isEmpty ? day!.lessons.suffix(3).map { $0 } : upcoming).prefix(3))
                ForEach(lessons) { lesson in
                    HStack(spacing: 9) {
                        Text("\(lesson.period)").font(.system(size: 12, weight: .bold)).foregroundStyle(current?.id == lesson.id ? badgeText : blue)
                            .frame(width: 25, height: 25).background(current?.id == lesson.id ? blue : blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 7))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(lesson.name).font(.custom("GmarketSansTTFMedium", size: 12)).lineLimit(1)
                            Text(lesson.teacher ?? "교사 정보 미제공").font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer(minLength: 2)
                        Text(lesson.start).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }
                Spacer(minLength: 0)
            }
            if let message, day != nil {
                Text(message).font(.system(size: 8)).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text("나이스 · 기본 수업 시각").font(.system(size: 8)).foregroundStyle(.secondary)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
