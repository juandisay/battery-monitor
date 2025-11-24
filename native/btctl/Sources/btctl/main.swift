import Foundation
import ServiceManagement
import Security
import os.log
import AppKit

/**
 * XPC command identifiers used by the daemon.
 */
enum BTDaemonCommCommand: UInt8 {
    case disablePowerAdapter
    case enablePowerAdapter
    case chargeToFull
    case chargeToLimit
    case disableCharging
    case prepareUpdate
    case finishUpdate
    case removeLegacyHelperFiles
    case prepareDisable
    case isSupported
    case pauseActivity
    case resumeActivity
}

/**
 * Client-side copy of the daemon XPC protocol.
 */
@objc protocol BTDaemonCommProtocol {
    func getUniqueId(
        reply: @Sendable @escaping (Data?) -> Void
    )

    func execute(
        authData: Data?,
        command: UInt8,
        reply: @Sendable @escaping (UInt8) -> Void
    )

    func getState(
        reply: @Sendable @escaping ([String: NSObject & Sendable]) -> Void
    )

    func getSettings(
        reply: @Sendable @escaping ([String: NSObject & Sendable]) -> Void
    )

    func setSettings(
        authData: Data,
        settings: [String: NSObject & Sendable],
        reply: @Sendable @escaping (UInt8) -> Void
    )
}

/**
 * Create privileged XPC connection to the daemon.
 */
func connectDaemon() -> NSXPCConnection {
    let conn = NSXPCConnection(
        machServiceName: "EMH49F8A2Y.me.mhaeuser.batterytoolkitd",
        options: .privileged
    )
    conn.remoteObjectInterface = NSXPCInterface(with: BTDaemonCommProtocol.self)
    conn.resume()
    return conn
}

func json(_ obj: Any) -> String {
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []) {
        return String(data: data, encoding: .utf8) ?? "{}"
    }
    return "{}"
}

func printResult(_ obj: Any) {
    print(json(obj))
}

func state() {
    let conn = connectDaemon()
    let sem = DispatchSemaphore(value: 0)
    let printed = UnsafeMutablePointer<Bool>.allocate(capacity: 1)
    printed.initialize(to: false)
    defer { printed.deallocate() }
    let daemon = conn.remoteObjectProxyWithErrorHandler { _ in
        let res = pmsetStateObj()
        printResult(res)
        printed.pointee = true
        sem.signal()
    } as! BTDaemonCommProtocol
    daemon.getState { state in
        var res: [String: Any] = ["ok": true]
        if let onBattery = state["onBattery"] as? NSNumber { res["onBattery"] = onBattery.boolValue }
        if let percent = state["percent"] as? NSNumber { res["percent"] = percent.intValue }
        printResult(res)
        printed.pointee = true
        sem.signal()
    }
    if sem.wait(timeout: .now() + 5) == .timedOut {
        if !printed.pointee { printResult(["ok": false, "error": "timeout"]) }
    }
}

/**
 * Fallback to pmset for battery state query.
 */
func pmsetStateObj() -> [String: Any] {
    let proc = Process()
    proc.launchPath = "/usr/bin/env"
    proc.arguments = ["pmset", "-g", "batt"]
    let pipe = Pipe()
    proc.standardOutput = pipe
    do { try proc.run() } catch {
        return ["ok": false, "error": "pmset_failed"]
    }
    proc.waitUntilExit()
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    let text = String(data: data, encoding: .utf8) ?? ""
    var percent: Int? = nil
    if let regex = try? NSRegularExpression(pattern: "(\\d{1,3})%", options: []) {
        let m = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: (text as NSString).length))
        if let m = m, m.numberOfRanges >= 2 {
            let r = m.range(at: 1)
            if let range = Range(r, in: text) {
                percent = Int(text[range])
            }
        }
    }
    let onBattery = text.range(of: "Battery Power", options: .caseInsensitive) != nil
    var res: [String: Any] = ["ok": true, "onBattery": onBattery]
    if let p = percent { res["percent"] = p }
    return res
}

func approve(_ timeout: Int) {
    if #available(macOS 13.0, *) {
        ServiceManagement.SMAppService.openSystemSettingsLoginItems()
        printResult(["ok": true, "timeout": timeout, "approved": false])
    } else {
        printResult(["ok": false, "error": "unsupported_os"]) 
    }
}

func start() {
    printResult(["ok": true, "requiresApproval": true]) 
}

func upgrade() {
    printResult(["ok": true, "requiresApproval": true]) 
}

func remove() {
    printResult(["ok": true]) 
}

func getSettings() {
    let fm = FileManager.default
    let dir = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let url = dir.appendingPathComponent("Battery Monitor/cli-settings.json")
    if let data = try? Data(contentsOf: url),
       let obj = try? JSONSerialization.jsonObject(with: data) {
        printResult(["ok": true, "settings": obj])
    } else {
        printResult(["ok": true, "settings": [:]])
    }
}

func setSettings(_ payload: String) {
    let fm = FileManager.default
    let dir = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let folder = dir.appendingPathComponent("Battery Monitor")
    try? fm.createDirectory(at: folder, withIntermediateDirectories: true)
    let url = folder.appendingPathComponent("cli-settings.json")
    if let data = payload.data(using: .utf8) {
        try? data.write(to: url)
    }
    printResult(["ok": true])
}

func disablePowerAdapter() {
    guard let auth = acquireManageAuth() else {
        printResult(["ok": false, "error": "not_authorized"]) ; return
    }
    execCommandWithAuth(.disablePowerAdapter, authData: auth)
}
func enablePowerAdapter() { execCommandNoAuth(.enablePowerAdapter) }
func chargeLimit() { execCommandNoAuth(.chargeToLimit) }
func chargeFull() { execCommandNoAuth(.chargeToFull) }
func disableCharging() {
    guard let auth = acquireManageAuth() else {
        printResult(["ok": false, "error": "not_authorized"]) ; return
    }
    execCommandWithAuth(.disableCharging, authData: auth)
}
func cmdPause() {
    guard let auth = acquireManageAuth() else {
        printResult(["ok": false, "error": "not_authorized"]) ; return
    }
    execCommandWithAuth(.pauseActivity, authData: auth)
}
func cmdResume() {
    guard let auth = acquireManageAuth() else {
        printResult(["ok": false, "error": "not_authorized"]) ; return
    }
    execCommandWithAuth(.resumeActivity, authData: auth)
}

/**
 * Execute an XPC command without authorization.
 */
func execCommandNoAuth(_ cmd: BTDaemonCommCommand) {
    let conn = connectDaemon()
    let sem = DispatchSemaphore(value: 0)
    let codePtr = UnsafeMutablePointer<Int32>.allocate(capacity: 1)
    codePtr.initialize(to: -2)
    defer { codePtr.deallocate() }
    let daemon = conn.remoteObjectProxyWithErrorHandler { err in
        os_log("exec command failed: %{public}@", String(describing: err))
        codePtr.pointee = -1
        sem.signal()
    } as! BTDaemonCommProtocol
    daemon.execute(authData: nil, command: cmd.rawValue) { code in
        codePtr.pointee = Int32(code)
        sem.signal()
    }
    if sem.wait(timeout: .now() + 5) == .timedOut { codePtr.pointee = -2 }
    let c = codePtr.pointee
    if c == 0 { printResult(["ok": true]) }
    else if c == -1 { printResult(["ok": false, "error": "comm_failed"]) }
    else if c == -2 { printResult(["ok": false, "error": "timeout"]) }
    else { printResult(["ok": false, "error": "daemon_error", "code": Int(c)]) }
}

/**
 * Execute an XPC command with authorization.
 */
func execCommandWithAuth(_ cmd: BTDaemonCommCommand, authData: Data) {
    let conn = connectDaemon()
    let sem = DispatchSemaphore(value: 0)
    let codePtr = UnsafeMutablePointer<Int32>.allocate(capacity: 1)
    codePtr.initialize(to: -2)
    defer { codePtr.deallocate() }
    let daemon = conn.remoteObjectProxyWithErrorHandler { err in
        os_log("exec command failed: %{public}@", String(describing: err))
        codePtr.pointee = -1
        sem.signal()
    } as! BTDaemonCommProtocol
    daemon.execute(authData: authData, command: cmd.rawValue) { code in
        codePtr.pointee = Int32(code)
        sem.signal()
    }
    if sem.wait(timeout: .now() + 5) == .timedOut { codePtr.pointee = -2 }
    let c = codePtr.pointee
    if c == 0 { printResult(["ok": true]) }
    else if c == -1 { printResult(["ok": false, "error": "comm_failed"]) }
    else if c == -2 { printResult(["ok": false, "error": "timeout"]) }
    else { printResult(["ok": false, "error": "daemon_error", "code": Int(c)]) }
}

/**
 * Acquire Authorization for manage-level operations.
 */
func acquireManageAuth() -> Data? {
    let rightName = "me.mhaeuser.batterytoolkitd.manage"
    var authRef: AuthorizationRef? = nil
    let statusCreate = AuthorizationCreate(nil, nil, [], &authRef)
    guard statusCreate == errAuthorizationSuccess, let authRef else { return nil }
    var item = AuthorizationItem(name: (rightName as NSString).utf8String!, valueLength: 0, value: nil, flags: 0)
    let status = withUnsafeMutablePointer(to: &item) { itemPtr -> OSStatus in
        var rights = AuthorizationRights(count: 1, items: itemPtr)
        return AuthorizationCopyRights(authRef, &rights, nil, [.interactionAllowed, .extendRights, .preAuthorize], nil)
    }
    guard status == errAuthorizationSuccess else { return nil }
    var ext = AuthorizationExternalForm()
    let statusForm = AuthorizationMakeExternalForm(authRef, &ext)
    guard statusForm == errAuthorizationSuccess else { return nil }
    return Data(bytes: &ext.bytes, count: Int(kAuthorizationExternalFormLength))
}

/**
 * Implemented above; no duplicates.
 */

let args = CommandLine.arguments.dropFirst()
guard let cmd = args.first else {
    printResult(["ok": false, "error": "no_command"]) 
    exit(1)
}

switch cmd.lowercased() {
case "start": start()
case "upgrade": upgrade()
case "approve":
    let t = Int(args.dropFirst().first ?? "20") ?? 20
    approve(t)
case "remove": remove()
case "state": state()
case "get-settings": getSettings()
case "set-settings":
    let payload = String(args.dropFirst().first ?? "{}")
    setSettings(payload)
case "disable-power": disablePowerAdapter()
case "enable-power": enablePowerAdapter()
case "charge-limit": chargeLimit()
case "charge-full": chargeFull()
case "disable-charging": disableCharging()
case "pause": cmdPause()
case "resume": cmdResume()
case "is-supported": execCommandNoAuth(.isSupported)
case "authorize-manage": authorizeManage()
case "register-daemon": registerDaemon()
default:
    printResult(["ok": false, "error": "unknown_command", "command": cmd]) 
    exit(1)
}
func authorizeManage() {
    if let _ = acquireManageAuth() { printResult(["ok": true]) }
    else { printResult(["ok": false, "error": "not_authorized"]) }
}
/**
 * Enable daemon via SMAppService.
 */
func registerDaemon() {
    if #available(macOS 13.0, *) {
        let plistName = "me.mhaeuser.batterytoolkitd.plist"
        let bundlePath = Bundle.main.bundlePath
        guard bundlePath.hasSuffix(".app") else {
            printResult(["ok": false, "error": "not_in_app_bundle"]) ; return
        }
        let plistPath = URL(fileURLWithPath: bundlePath)
            .appendingPathComponent("Contents/Library/LaunchServices/\(plistName)")
        let exists = FileManager.default.fileExists(atPath: plistPath.path)
        guard exists else {
            printResult(["ok": false, "error": "missing_plist", "path": plistPath.path]) ; return
        }
        let svc = SMAppService.daemon(plistName: plistName)
        do {
            try svc.register()
            let ok = svc.status == .enabled || svc.status == .requiresApproval
            printResult(["ok": ok, "status": svc.status.rawValue])
        } catch {
            printResult(["ok": false, "error": "enable_failed", "message": String(describing: error)])
        }
    } else {
        var authRef: AuthorizationRef? = nil
        let statusCreate = AuthorizationCreate(nil, nil, [], &authRef)
        guard statusCreate == errAuthorizationSuccess, let authRef else {
            printResult(["ok": false, "error": "not_authorized"]) ; return
        }
        var item = AuthorizationItem(name: (kSMRightModifySystemDaemons as NSString).utf8String!, valueLength: 0, value: nil, flags: 0)
        let status = withUnsafeMutablePointer(to: &item) { itemPtr -> OSStatus in
            var rights = AuthorizationRights(count: 1, items: itemPtr)
            return AuthorizationCopyRights(authRef, &rights, nil, [.interactionAllowed, .extendRights, .preAuthorize], nil)
        }
        guard status == errAuthorizationSuccess else {
            printResult(["ok": false, "error": "not_authorized"]) ; return
        }
        var err: Unmanaged<CFError>? = nil
        let blessed = SMJobBless(kSMDomainSystemLaunchd, "me.mhaeuser.batterytoolkitd" as CFString, authRef, &err)
        if blessed { printResult(["ok": true]) }
        else { printResult(["ok": false, "error": "enable_failed", "message": String(describing: err)]) }
    }
}
