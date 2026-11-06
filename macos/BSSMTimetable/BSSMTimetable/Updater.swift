import SwiftUI
import Sparkle
import Combine

@MainActor
final class AppUpdates: ObservableObject {
    let controller: SPUStandardUpdaterController
    @Published var canCheck = false
    init() {
        controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
        controller.updater.publisher(for: \.canCheckForUpdates).assign(to: &$canCheck)
    }
    var automatic: Bool {
        get { controller.updater.automaticallyChecksForUpdates && controller.updater.automaticallyDownloadsUpdates }
        set {
            controller.updater.automaticallyChecksForUpdates = newValue
            controller.updater.automaticallyDownloadsUpdates = newValue
            objectWillChange.send()
        }
    }
    func check() { controller.checkForUpdates(nil) }
}
