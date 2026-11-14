import AuthenticationServices
import CryptoKit
import UIKit
import WebKit

/// Il ponte tra il sito e iOS: accesso con Apple e Google, condivisione, tema e colori delle fasce, link esterni,
/// avvisi e file scaricati. Il sito lo trova in window.FlocketsNativo (vedi `script`); ogni richiesta torna come Promise.
final class Ponte: NSObject {
    let server = Server()
    weak var controllore: Controllore?
    var web: WKWebView? { controllore?.web }
    private var apple: AccessoApple?
    private var sessioneWeb: ASWebAuthenticationSession?
    private var scaricati: [ObjectIdentifier: URL] = [:]

    static let ritorno = "site.flockets.app"

    /// Iniettato prima di ogni pagina: window.FlocketsNativo, la classe «in-app» su <html>, il tema
    /// e i colori della pagina in cima e in fondo (per le fasce dell'ora e della barra home).
    static let script = """
    (() => {
      const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flockets;
      if (!h) return;
      const manda = m => h.postMessage(m).catch(() => {});
      window.FlocketsNativo = {
        piattaforma: 'ios',
        sito: '\(Server.online.absoluteString)/',
        ritorno: '\(ritorno)://login-callback',
        chiedi: (tipo, dati) => h.postMessage(Object.assign({ tipo: tipo }, dati || {})),
      };
      const radice = document.documentElement;
      radice.classList.add('in-app');
      // il primo sfondo pieno sotto il punto (i trasparenti e i vetri leggeri non contano; dei canvas si leggono i pixel)
      const rgb = c => { const n = (c || '').match(/[\\d.]+/g); return n && n.length >= 3 && (n.length < 4 || +n[3] >= 0.5) ? n.slice(0, 3).map(Number) : null; };
      const tela = (el, y) => {
        try {
          const r = el.getBoundingClientRect(), g = el.getContext('2d');
          if (!g || !r.width || !r.height) return null;
          const sx = el.width / r.width, cx = Math.floor((innerWidth / 2 - r.left) * sx), w = Math.max(1, Math.floor(60 * sx));
          const cy = Math.min(el.height - 1, Math.max(0, Math.floor((y - r.top) * el.height / r.height)));
          const d = g.getImageData(Math.max(0, cx - w), cy, Math.min(el.width, 2 * w), 1).data, s = [0, 0, 0, 0], q = [0, 0, 0], n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) { for (let k = 0; k < 3; k++) { s[k] += d[i + k]; q[k] += d[i + k] * d[i + k]; } s[3] += d[i + 3]; }
          const m = s.slice(0, 3).map(v => v / n), varia = Math.sqrt(q.reduce((t, v, k) => t + v / n - m[k] * m[k], 0) / 3);
          return s[3] / n >= 128 && varia < 40 ? m : null;   // solo una fascia quasi uniforme (il prato sì, la folla no)
        } catch (e) { return null; }
      };
      const arrotonda = c => c.map(v => Math.min(255, Math.round(v / 6) * 6));
      const colore = y => {
        const x = innerWidth / 2;
        // i canvas hanno pointer-events: none e elementsFromPoint non li vede: si cercano per posizione, l'ultimo sopra
        for (const el of [...document.querySelectorAll('canvas')].reverse()) {
          const r = el.getBoundingClientRect();
          if (!r.width || r.top > y || r.bottom < y || r.left > x || r.right < x) continue;
          const c = tela(el, y);
          if (c) return arrotonda(c);
        }
        for (const el of document.elementsFromPoint(x, y)) { const c = rgb(getComputedStyle(el).backgroundColor); if (c) return arrotonda(c); }
        return rgb(getComputedStyle(document.body).backgroundColor) || [250, 250, 248];
      };
      let ultimo = '', inAttesa = false;
      const barre = () => {
        inAttesa = false;
        if (!document.body) return;
        const a = colore(1), b = colore(innerHeight - 2), k = a + '|' + b;
        if (k !== ultimo) { ultimo = k; manda({ tipo: 'barre', alto: a, basso: b }); }
      };
      const presto = () => { if (!inAttesa) { inAttesa = true; requestAnimationFrame(barre); } };
      addEventListener('scroll', presto, { capture: true, passive: true });
      addEventListener('resize', presto);
      addEventListener('hashchange', () => setTimeout(presto, 80));
      addEventListener('load', presto);
      setInterval(presto, 700);
      const tema = () => { if (radice.dataset.tema) { manda({ tipo: 'tema', scuro: radice.dataset.tema === 'scuro' }); setTimeout(presto, 80); } };
      new MutationObserver(tema).observe(radice, { attributes: true, attributeFilter: ['data-tema'] });
      tema();
    })();
    """

    /// il controller in cima, da cui presentare fogli e avvisi
    private func cima() -> UIViewController? {
        var vc = (web?.window ?? Ponte.finestra())?.rootViewController
        while let sopra = vc?.presentedViewController { vc = sopra }
        return vc
    }

    static func finestra() -> UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
    }

    private func presenta(_ cose: [Any]) {
        guard let vc = cima() else { return }
        let foglio = UIActivityViewController(activityItems: cose, applicationActivities: nil)
        foglio.popoverPresentationController?.sourceView = web
        vc.present(foglio, animated: true)
    }
}

// MARK: - Richieste dal sito

extension Ponte: WKScriptMessageHandlerWithReply {
    func userContentController(_ contenuti: WKUserContentController, didReceive messaggio: WKScriptMessage,
                               replyHandler risposta: @escaping (Any?, String?) -> Void) {
        guard let corpo = messaggio.body as? [String: Any], let tipo = corpo["tipo"] as? String else {
            risposta(nil, "Richiesta non valida")
            return
        }
        switch tipo {
        case "tema":
            controllore?.tema(scuro: corpo["scuro"] as? Bool ?? false)
            risposta(true, nil)
        case "barre":
            let numeri = { (v: Any?) in ((v as? [Any]) ?? []).compactMap { ($0 as? NSNumber)?.doubleValue } }
            let a = numeri(corpo["alto"]), b = numeri(corpo["basso"])
            if a.count == 3, b.count == 3 { controllore?.barre(alto: a, basso: b) }
            risposta(true, nil)
        case "apple":
            accediConApple(risposta)
        case "web":
            // solo la pagina di accesso di Supabase (Google e gli altri provider passano da lì)
            guard let s = corpo["url"] as? String, let url = URL(string: s), url.scheme == "https",
                  let host = url.host, host.hasSuffix(".supabase.co") || host.hasSuffix("flockets.site") else {
                risposta(nil, "Indirizzo non ammesso")
                return
            }
            accediSulWeb(url, risposta)
        case "condividi":
            condividi(testo: corpo["testo"] as? String ?? "Flockets")
            risposta(true, nil)
        default:
            risposta(nil, "Richiesta sconosciuta")
        }
    }

    /// Accedi con Apple dal sistema: il sito riceve il token e il nonce e li passa a Supabase (signInWithIdToken).
    private func accediConApple(_ risposta: @escaping (Any?, String?) -> Void) {
        let a = AccessoApple(finestra: web?.window ?? Ponte.finestra()) { [weak self] dati, errore in
            self?.apple = nil
            risposta(dati, errore)
        }
        apple = a
        a.avvia()
    }

    /// Google (e ogni provider OAuth) in una finestra di Safari: il sito riceve l'indirizzo di ritorno con il codice.
    private func accediSulWeb(_ url: URL, _ risposta: @escaping (Any?, String?) -> Void) {
        let fine: (URL?, Error?) -> Void = { [weak self] indirizzo, errore in
            DispatchQueue.main.async {
                self?.sessioneWeb = nil
                if let indirizzo { risposta(indirizzo.absoluteString, nil); return }
                let annullato = (errore as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                risposta(nil, annullato ? "annullato" : (errore?.localizedDescription ?? "Accesso non riuscito"))
            }
        }
        let sessione: ASWebAuthenticationSession
        if #available(iOS 17.4, *) {
            sessione = ASWebAuthenticationSession(url: url, callback: .customScheme(Ponte.ritorno), completionHandler: fine)
        } else {
            sessione = ASWebAuthenticationSession(url: url, callbackURLScheme: Ponte.ritorno, completionHandler: fine)
        }
        sessione.presentationContextProvider = self
        sessioneWeb = sessione
        if !sessione.start() {
            sessioneWeb = nil
            risposta(nil, "Non riesco ad aprire la pagina di accesso")
        }
    }

    /// Condividi l'analisi: l'istantanea di quello che si vede più il riassunto scritto dal sito.
    private func condividi(testo: String) {
        guard let web else { return }
        web.takeSnapshot(with: nil) { [weak self] immagine, _ in
            var cose: [Any] = [testo]
            if let immagine { cose.insert(immagine, at: 0) }
            self?.presenta(cose)
        }
    }
}

extension Ponte: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        web?.window ?? Ponte.finestra() ?? ASPresentationAnchor()
    }
}

// MARK: - Navigazione: le pagine esterne si aprono in Safari, i file scaricati si condividono

extension Ponte: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor azione: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if azione.shouldPerformDownload { decisionHandler(.download); return }
        if let url = azione.request.url, let schema = url.scheme?.lowercased(),
           ["http", "https", "mailto", "tel", "sms"].contains(schema), azione.targetFrame?.isMainFrame ?? true {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor risposta: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(risposta.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    /// se iOS chiude la pagina per liberare memoria, si riapre
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

extension Ponte: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let cartella = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: cartella, withIntermediateDirectories: true)
        let file = cartella.appendingPathComponent(suggestedFilename.isEmpty ? "flockets" : suggestedFilename)
        scaricati[ObjectIdentifier(download)] = file
        completionHandler(file)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let file = scaricati.removeValue(forKey: ObjectIdentifier(download)) { presenta([file]) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        scaricati.removeValue(forKey: ObjectIdentifier(download))
    }
}

// MARK: - Finestre nuove, alert e confirm del sito

extension Ponte: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for azione: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = azione.request.url {
            if url.scheme == Server.schema { webView.load(azione.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage messaggio: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        avviso(messaggio, conAnnulla: false) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage messaggio: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        avviso(messaggio, conAnnulla: true, fine: completionHandler)
    }

    private func avviso(_ testo: String, conAnnulla: Bool, fine: @escaping (Bool) -> Void) {
        guard let vc = cima() else { fine(false); return }
        let a = UIAlertController(title: nil, message: testo, preferredStyle: .alert)
        if conAnnulla { a.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in fine(false) }) }
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in fine(true) })
        vc.present(a, animated: true)
    }
}

// MARK: - Accedi con Apple

/// Una richiesta di «Accedi con Apple»: il nonce casuale va ad Apple come SHA-256 e a Supabase in chiaro.
final class AccessoApple: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let nonce = AccessoApple.casuale()
    private let fine: ([String: Any]?, String?) -> Void
    private weak var finestra: UIWindow?

    init(finestra: UIWindow?, fine: @escaping ([String: Any]?, String?) -> Void) {
        self.finestra = finestra
        self.fine = fine
    }

    func avvia() {
        let richiesta = ASAuthorizationAppleIDProvider().createRequest()
        richiesta.requestedScopes = [.fullName, .email]
        richiesta.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
        let controller = ASAuthorizationController(authorizationRequests: [richiesta])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credenziale = authorization.credential as? ASAuthorizationAppleIDCredential,
              let dati = credenziale.identityToken, let token = String(data: dati, encoding: .utf8) else {
            fine(nil, "Apple non ha mandato il token")
            return
        }
        var r: [String: Any] = ["token": token, "nonce": nonce]
        // il nome Apple lo dà solo al primo accesso
        if let nome = credenziale.fullName {
            let s = PersonNameComponentsFormatter().string(from: nome)
            if !s.isEmpty { r["nome"] = s }
        }
        fine(r, nil)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let annullato = (error as? ASAuthorizationError)?.code == .canceled
        fine(nil, annullato ? "annullato" : error.localizedDescription)
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        finestra ?? Ponte.finestra() ?? ASPresentationAnchor()
    }

    static func casuale() -> String {
        var byte = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, byte.count, &byte)
        return byte.map { String(format: "%02x", $0) }.joined()
    }
}
