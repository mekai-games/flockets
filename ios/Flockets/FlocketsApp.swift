import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {}

/// La scena è dichiarata in Info.plist (UISceneConfigurations), così vale anche per le sessioni che iOS ripristina.

final class Scena: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let s = scene as? UIWindowScene else { return }
        let finestra = UIWindow(windowScene: s)
        finestra.rootViewController = Controllore()
        finestra.makeKeyAndVisible()
        window = finestra
    }
}
