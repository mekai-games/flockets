import UIKit
import WebKit

/// La pagina del sito, incluso nell'app e servito da flockets://localhost/ (un'origine fissa: localStorage e sessione restano).
/// Sopra e sotto la pagina due fasce (ora e batteria, barra home) prendono il colore della pagina in quel punto.
final class Controllore: UIViewController {
    private(set) var web: WKWebView!
    private let ponte = Ponte()
    private let alto = UIView()
    private let basso = UIView()
    private var testoChiaro = false

    override var preferredStatusBarStyle: UIStatusBarStyle { testoChiaro ? .lightContent : .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(named: "Sfondo")
        alto.backgroundColor = view.backgroundColor
        basso.backgroundColor = view.backgroundColor
        ponte.controllore = self
        web = Controllore.nuovaPagina(ponte)
        for v in [alto, basso, web!] {
            v.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(v)
        }
        let sicura = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            alto.topAnchor.constraint(equalTo: view.topAnchor),
            alto.bottomAnchor.constraint(equalTo: sicura.topAnchor),
            alto.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            alto.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            basso.topAnchor.constraint(equalTo: sicura.bottomAnchor),
            basso.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            basso.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            basso.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.topAnchor.constraint(equalTo: sicura.topAnchor),
            web.bottomAnchor.constraint(equalTo: sicura.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        web.load(URLRequest(url: Server.inizio))
    }

    /// i colori della pagina in cima e in fondo (0–255); l'ora diventa chiara sopra un colore scuro
    func barre(alto a: [Double], basso b: [Double]) {
        let colore = { (c: [Double]) in UIColor(red: c[0] / 255, green: c[1] / 255, blue: c[2] / 255, alpha: 1) }
        UIView.animate(withDuration: 0.18) {
            self.alto.backgroundColor = colore(a)
            self.basso.backgroundColor = colore(b)
        }
        web.underPageBackgroundColor = colore(b)
        let chiaro = (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255 < 0.5
        if chiaro != testoChiaro {
            testoChiaro = chiaro
            UIView.animate(withDuration: 0.18) { self.setNeedsStatusBarAppearanceUpdate() }
        }
    }

    /// il tema scelto nel sito vale anche per tastiera, avvisi e fogli di condivisione
    func tema(scuro: Bool) {
        view.window?.overrideUserInterfaceStyle = scuro ? .dark : .light
    }

    private static func nuovaPagina(_ ponte: Ponte) -> WKWebView {
        let conf = WKWebViewConfiguration()
        conf.setURLSchemeHandler(ponte.server, forURLScheme: Server.schema)
        conf.allowsInlineMediaPlayback = true
        conf.mediaTypesRequiringUserActionForPlayback = []
        conf.applicationNameForUserAgent = "Mobile/15E148 FlocketsApp/1.0"
        let contenuti = conf.userContentController
        contenuti.addUserScript(WKUserScript(source: Ponte.script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        contenuti.addScriptMessageHandler(ponte, contentWorld: .page, name: "flockets")

        let web = WKWebView(frame: .zero, configuration: conf)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.allowsBackForwardNavigationGestures = true
        web.navigationDelegate = ponte
        web.uiDelegate = ponte
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }   // Safari → Sviluppo, per provare
        #endif
        return web
    }
}

/// Serve i file del sito dalla cartella «sito» del bundle e inoltra le chiamate a /api/ al sito online.
final class Server: NSObject, WKURLSchemeHandler {
    static let schema = "flockets"
    static let inizio = URL(string: "flockets://localhost/")!
    static let online = URL(string: "https://flockets.vercel.app")!

    private let radice = Bundle.main.resourceURL!.appendingPathComponent("sito", isDirectory: true).standardizedFileURL
    private var inCorso = Set<ObjectIdentifier>()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        if url.path.hasPrefix("/api/") { inoltra(task, url: url); return }
        var percorso = url.path
        if percorso.isEmpty || percorso.hasSuffix("/") { percorso += "index.html" }
        let file = radice.appendingPathComponent(String(percorso.drop(while: { $0 == "/" }))).standardizedFileURL
        guard file.path.hasPrefix(radice.path + "/"), let dati = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            rispondi(task, url: url, stato: 404, campi: ["Content-Type": "text/plain; charset=utf-8"], dati: Data("Non trovato".utf8))
            return
        }
        var campi = ["Content-Type": Server.tipo(file.pathExtension), "Cache-Control": "no-cache", "Accept-Ranges": "bytes"]
        // audio e video chiedono il file a pezzi
        if let r = task.request.value(forHTTPHeaderField: "Range"), let (da, a) = Server.intervallo(r, totale: dati.count) {
            campi["Content-Range"] = "bytes \(da)-\(a)/\(dati.count)"
            rispondi(task, url: url, stato: 206, campi: campi, dati: dati.subdata(in: da ..< a + 1))
            return
        }
        rispondi(task, url: url, stato: 200, campi: campi, dati: dati)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        inCorso.remove(ObjectIdentifier(task))
    }

    private func rispondi(_ task: WKURLSchemeTask, url: URL, stato: Int, campi: [String: String], dati: Data) {
        var c = campi
        c["Content-Length"] = String(dati.count)
        task.didReceive(HTTPURLResponse(url: url, statusCode: stato, httpVersion: "HTTP/1.1", headerFields: c)!)
        task.didReceive(dati)
        task.didFinish()
    }

    /// /api/… → https://flockets.vercel.app/api/…: stesso metodo e stesso corpo, senza Origin (il server lo controlla)
    private func inoltra(_ task: WKURLSchemeTask, url: URL) {
        var parti = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        parti.scheme = Server.online.scheme
        parti.host = Server.online.host
        parti.port = nil
        var richiesta = URLRequest(url: parti.url!, timeoutInterval: 120)
        richiesta.httpMethod = task.request.httpMethod ?? "GET"
        richiesta.httpBody = task.request.httpBody ?? Server.leggi(task.request.httpBodyStream)
        for (k, v) in task.request.allHTTPHeaderFields ?? [:]
        where !["origin", "host", "referer", "cookie", "content-length"].contains(k.lowercased()) {
            richiesta.setValue(v, forHTTPHeaderField: k)
        }
        let id = ObjectIdentifier(task)
        inCorso.insert(id)
        URLSession.shared.dataTask(with: richiesta) { [weak self] dati, risposta, errore in
            DispatchQueue.main.async {
                guard let self, self.inCorso.remove(id) != nil else { return }   // la pagina non la aspetta più
                if let errore { task.didFailWithError(errore); return }
                let h = risposta as? HTTPURLResponse
                var campi: [String: String] = [:]
                for (k, v) in h?.allHeaderFields ?? [:] {
                    guard let k = k as? String, !["content-encoding", "content-length", "transfer-encoding"].contains(k.lowercased()) else { continue }
                    campi[k] = "\(v)"
                }
                self.rispondi(task, url: url, stato: h?.statusCode ?? 502, campi: campi, dati: dati ?? Data())
            }
        }.resume()
    }

    static func leggi(_ flusso: InputStream?) -> Data? {
        guard let flusso else { return nil }
        flusso.open()
        defer { flusso.close() }
        var dati = Data()
        var buffer = [UInt8](repeating: 0, count: 65_536)
        while flusso.hasBytesAvailable {
            let n = flusso.read(&buffer, maxLength: buffer.count)
            if n <= 0 { break }
            dati.append(buffer, count: n)
        }
        return dati
    }

    /// «bytes=da-a», «bytes=da-» o «bytes=-n» (gli ultimi n)
    static func intervallo(_ testo: String, totale: Int) -> (Int, Int)? {
        guard totale > 0, testo.hasPrefix("bytes="), let primo = testo.dropFirst(6).split(separator: ",").first else { return nil }
        let p = primo.split(separator: "-", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        guard p.count == 2 else { return nil }
        if p[0].isEmpty, let n = Int(p[1]), n > 0 { return (max(0, totale - n), totale - 1) }
        guard let da = Int(p[0]), da < totale else { return nil }
        let a = Int(p[1]).map { min($0, totale - 1) } ?? totale - 1
        return da <= a ? (da, a) : nil
    }

    static func tipo(_ estensione: String) -> String {
        switch estensione.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "csv": return "text/csv; charset=utf-8"
        case "py", "txt", "md": return "text/plain; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "ico": return "image/x-icon"
        case "mp4", "m4v": return "video/mp4"
        case "webm": return "video/webm"
        case "mp3": return "audio/mpeg"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "wasm": return "application/wasm"
        case "pdf": return "application/pdf"
        case "webmanifest": return "application/manifest+json"
        default: return "application/octet-stream"
        }
    }
}
