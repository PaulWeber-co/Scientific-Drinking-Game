// In das App-Target des vorhandenen Capacitor-Xcode-Projekts kopieren.
// Mit dem iOS-26-SDK gebaut, zeichnet UIKit seine systemeigene Tab-Leiste.
import UIKit
import Capacitor

@objc(NativeTabsPlugin)
public class NativeTabsPlugin: CAPPlugin, CAPBridgedPlugin, UITabBarDelegate {
    public let identifier = "NativeTabsPlugin"
    public let jsName = "NativeTabs"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSelected", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    private var bar: UITabBar?

    @objc public func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let root = self.bridge?.viewController?.view else {
                call.reject("Bridge view is unavailable")
                return
            }
            if self.bar == nil {
                let bar = UITabBar()
                bar.translatesAutoresizingMaskIntoConstraints = false
                bar.delegate = self
                bar.isTranslucent = true
                let entries: [(String, String)] = [
                    ("Spiele", "square.grid.2x2"),
                    ("Runde", "person.2"),
                    ("Pegel", "chart.xyaxis.line"),
                    ("Album", "photo.on.rectangle")
                ]
                bar.items = entries.enumerated().map { index, entry in
                    let item = UITabBarItem(title: entry.0, image: UIImage(systemName: entry.1), tag: index)
                    return item
                }
                root.addSubview(bar)
                NSLayoutConstraint.activate([
                    bar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                    bar.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                    bar.bottomAnchor.constraint(equalTo: root.bottomAnchor)
                ])
                self.bar = bar
            }
            self.select(call.getInt("selected") ?? 0)
            self.bar?.isHidden = false
            call.resolve()
        }
    }

    @objc public func setSelected(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.select(call.getInt("selected") ?? 0)
            call.resolve()
        }
    }

    @objc public func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.bar?.isHidden = true
            call.resolve()
        }
    }

    private func select(_ index: Int) {
        guard let items = bar?.items, items.indices.contains(index) else { return }
        bar?.selectedItem = items[index]
    }

    public func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        notifyListeners("tabSelected", data: ["index": item.tag])
    }
}
