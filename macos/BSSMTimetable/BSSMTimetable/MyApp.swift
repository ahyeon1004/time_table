import SwiftUI

@main struct MyApp: App {
    @StateObject private var updates = AppUpdates()
    var body: some Scene {
        WindowGroup { ContentView().environmentObject(updates) }
        .commands {
            CommandGroup(after: .appInfo) {
                Button("업데이트 확인…", action: updates.check).disabled(!updates.canCheck)
            }
        }
    }
}
