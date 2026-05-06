import SwiftRs
import Tauri
import UIKit
import WebKit

// Observes UITouch.type without consuming touches. Reports the touch type
// for every touch-down so JS can show "pencil" vs "finger".
class TouchTypeRecognizer: UIGestureRecognizer {
    var onTouch: ((UITouch.TouchType) -> Void)?

    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        // Critical: do not steal touches from the WKWebView.
        self.cancelsTouchesInView = false
        self.delaysTouchesBegan = false
        self.delaysTouchesEnded = false
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        for touch in touches {
            onTouch?(touch.type)
        }
        // Never recognize - immediately fail so we stay passive observers.
        self.state = .failed
    }
}

class PencilPlugin: Plugin {
    private var pencilInteraction: UIPencilInteraction?
    private var recognizer: TouchTypeRecognizer?

    @objc public override func load(webview: WKWebView) {
        // 1. Touch type detection (pencil vs finger) on every touch-down.
        let r = TouchTypeRecognizer(target: nil, action: nil)
        r.onTouch = { [weak self] type in
            let kind: String
            switch type {
            case .pencil: kind = "pencil"
            default:      kind = "finger"
            }
            self?.trigger("touch", data: ["type": kind])
        }
        webview.addGestureRecognizer(r)
        self.recognizer = r

        // 2. Apple Pencil double-tap (Pencil 2nd gen / Pencil Pro).
        let interaction = UIPencilInteraction()
        interaction.delegate = self
        webview.addInteraction(interaction)
        self.pencilInteraction = interaction
    }
}

extension PencilPlugin: UIPencilInteractionDelegate {
    // Older API (iOS 12.1+). The newer pencilInteraction(_:didReceiveTap:)
    // exists from iOS 17.5 but this one is still invoked when the new one
    // is not implemented, which keeps the demo simple.
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        self.trigger("double-tap", data: [:])
    }
}

@_cdecl("init_plugin_pencil")
func initPlugin() -> Plugin {
    return PencilPlugin()
}
