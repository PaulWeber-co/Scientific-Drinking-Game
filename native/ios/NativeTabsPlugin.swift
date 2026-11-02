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
    private var height: NSLayoutConstraint?

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
                // UITabBar allein bekommt keinen Container, der ihre Hoehe
                // bestimmt. System-Metrik verwenden, auch nach Rotation.
                let height = bar.heightAnchor.constraint(equalToConstant: 49)
                NSLayoutConstraint.activate([
                    bar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                    bar.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                    bar.bottomAnchor.constraint(equalTo: root.bottomAnchor),
                    height
                ])
                self.bar = bar
                self.height = height
            }
            self.bar?.overrideUserInterfaceStyle = call.getString("theme") == "light" ? .light : .dark
            self.select(call.getInt("selected") ?? 0)
            self.bar?.isHidden = false
            self.updateLayout()
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

    // Vom Bridge-Controller in viewDidLayoutSubviews() aufrufen; siehe Anleitung.
    public func updateLayout() {
        guard let bar = bar, let root = bridge?.viewController?.view else { return }
        let preferred = bar.sizeThatFits(CGSize(width: root.bounds.width, height: 0)).height
        let value = max(49, preferred)
        if height?.constant != value { height?.constant = value }
    }

    public func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard !tabBar.isHidden else { return }
        notifyListeners("tabSelected", data: ["index": item.tag])
    }
}
