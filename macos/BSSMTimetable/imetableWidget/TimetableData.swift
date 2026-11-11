import Foundation

struct SchoolLesson: Codable, Identifiable, Sendable {
    let period: Int
    let name: String
    let teacher: String?
    let start: String
    let end: String
    var id: Int { period }
}
struct SchoolDay: Codable, Sendable {
    let date: String
    let grade: String
    let classroom: String
    let source: String
    let fetchedAt: String?
    let usesDefaultBellTimes: Bool
    let lessons: [SchoolLesson]
}
enum SchoolClock {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        return calendar
    }
    static func dayKey(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }
    static func instant(day: String, time: String) -> Date? {
        let format = DateFormatter()
        format.calendar = calendar
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = calendar.timeZone
        format.dateFormat = "yyyy-MM-dd HH:mm"
        format.isLenient = false
        return format.date(from: "\(day) \(time)")
    }
}
enum SchoolAPI {
    static func loadAccount(code: String, now: Date) async throws -> SchoolDay {
        let date = SchoolClock.dayKey(now)
        var components = URLComponents(string: "https://bssm-timetable.vercel.app/api/widget")!
        components.queryItems = [URLQueryItem(name: "date", value: date)]
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(code)", forHTTPHeaderField: "Authorization")
        request.cachePolicy = .reloadIgnoringLocalCacheData

        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 6
        configuration.timeoutIntervalForResource = 8
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }
        let (data, response) = try await session.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            throw URLError(.userAuthenticationRequired)
        }
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let day = try JSONDecoder().decode(SchoolDay.self, from: data)
        guard ["1", "2", "3"].contains(day.grade),
              ["1", "2", "3", "4"].contains(day.classroom),
              day.date == date, day.source == "NEIS" else {
            throw URLError(.cannotParseResponse)
        }
        return day
    }
}
