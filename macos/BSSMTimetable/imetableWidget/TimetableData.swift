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
    static func origin(_ input: String) -> URL? {
        guard let url = URL(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/",
              let host = url.host,
              url.scheme == "https" || (url.scheme == "http" && ["127.0.0.1", "localhost"].contains(host))
        else { return nil }
        return url
    }
    static func load(origin: URL, grade: String, classroom: String, now: Date = Date(), token: String? = nil) async throws -> SchoolDay {
        guard ["1", "2", "3"].contains(grade), ["1", "2", "3", "4"].contains(classroom) else { throw URLError(.badURL) }
        var components = URLComponents(url: origin.appendingPathComponent("api/widget"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grade", value: grade), URLQueryItem(name: "classroom", value: classroom), URLQueryItem(name: "date", value: SchoolClock.dayKey(now))]
        var request = URLRequest(url: components.url!)
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 { throw URLError(.userAuthenticationRequired) }
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let result = try JSONDecoder().decode(SchoolDay.self, from: data)
        guard result.grade == grade, result.classroom == classroom, result.date == SchoolClock.dayKey(now), result.source == "NEIS" else { throw URLError(.cannotParseResponse) }
        return result
    }
}

extension SchoolAPI {
    private struct Profile: Decodable { let grade: String; let classroom: String }
    private struct Account: Decodable { let profile: Profile }
    static func loadAccount(code: String, now: Date = Date()) async throws -> SchoolDay {
        let origin = URL(string: "https://bssm-timetable.vercel.app")!
        var request = URLRequest(url: origin.appendingPathComponent("api/widget/account"))
        request.setValue("Bearer \(code)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 { throw URLError(.userAuthenticationRequired) }
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let account = try JSONDecoder().decode(Account.self, from: data)
        return try await load(origin: origin, grade: account.profile.grade, classroom: account.profile.classroom, now: now, token: code)
    }
}
