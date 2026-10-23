import Foundation
import Darwin
import IOKit.ps
import Network

// The helper emits read-only, newline-delimited JSON. It accepts no commands.
var pressure = "unknown"
let pressureSource = DispatchSource.makeMemoryPressureSource(eventMask: [.normal, .warning, .critical], queue: .main)
pressureSource.setEventHandler {
    let flags = pressureSource.data
    pressure = flags.contains(.critical) ? "critical" : flags.contains(.warning) ? "elevated" : "normal"
}
pressureSource.resume()
var network = "unknown"
let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in DispatchQueue.main.async { network = path.status == .satisfied ? (path.usesInterfaceType(.wifi) ? "Wi-Fi connected" : "Connected") : "Offline" } }
monitor.start(queue: DispatchQueue(label: "network"))
func processes() -> [[String: Any]] {
    let task = Process(); task.executableURL = URL(fileURLWithPath: "/bin/ps")
    task.arguments = ["-axo", "pid=,ppid=,uid=,rss=,%cpu=,stat=,comm="]
    let pipe = Pipe(); task.standardOutput = pipe; task.standardError = FileHandle.nullDevice
    do { try task.run() } catch { return [] }
    let data = pipe.fileHandleForReading.readDataToEndOfFile(); task.waitUntilExit()
    return (String(data: data, encoding: .utf8) ?? "").split(separator: "\n").compactMap { line in
        let p = line.split(maxSplits: 6, whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
        guard p.count == 7, let pid = Int(p[0]), let rss = Double(p[3]) else { return nil }
        return ["pid": pid, "ppid": Int(p[1]) ?? 0, "uid": Int(p[2]) ?? -1, "memory": rss * 1024, "cpu": Double(p[4]) ?? 0, "status": p[5], "path": p[6], "name": URL(fileURLWithPath: p[6]).lastPathComponent]
    }
}
func sample() {
    var vm = vm_statistics64(); var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &vm) { ptr in ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count) } }
    guard result == KERN_SUCCESS else { print("{\"error\":\"host_statistics64 unavailable\"}"); fflush(stdout); return }
    let page = Double(vm_kernel_page_size), total = Double(ProcessInfo.processInfo.physicalMemory)
    // Compressor residency is part of used memory, NOT additional availability.
    // Darwin's exported free_count includes speculative pages. Normalize the
    // free-only bucket before displaying separate categories to avoid double counting.
    let speculative = Double(vm.speculative_count) * page
    let free = max(0, Double(vm.free_count) * page - speculative)
    let inactive = Double(vm.inactive_count) * page
    let available = min(total, free + inactive + speculative)
    var swap = xsw_usage(); var swapSize = MemoryLayout<xsw_usage>.size
    let swapOK = sysctlbyname("vm.swapusage", &swap, &swapSize, nil, 0) == 0
    var battery: Any = NSNull()
    if let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(), let sources = IOPSCopyPowerSourcesList(info)?.takeRetainedValue() as? [CFTypeRef] {
        for source in sources { if let d = IOPSGetPowerSourceDescription(info, source)?.takeUnretainedValue() as? [String: Any], let current = d[kIOPSCurrentCapacityKey] as? Double, let max = d[kIOPSMaxCapacityKey] as? Double, max > 0 { battery = ["percent": current / max * 100, "charging": d[kIOPSIsChargingKey] as? Bool ?? false] } }
    }
    let payload: [String: Any] = ["timestamp": Date().timeIntervalSince1970 * 1000, "total": total, "used": total - available, "available": available, "free": free, "reclaimable": inactive + speculative, "compressed": Double(vm.compressor_page_count) * page, "wired": Double(vm.wire_count) * page, "swap": swapOK ? Double(swap.xsu_used) as Any : NSNull(), "pressure": pressure, "battery": battery, "network": network, "uptime": ProcessInfo.processInfo.systemUptime, "os": ProcessInfo.processInfo.operatingSystemVersionString, "processes": processes()]
    if let data = try? JSONSerialization.data(withJSONObject: payload), let text = String(data: data, encoding: .utf8) { print(text); fflush(stdout) }
}
// Process enumeration and VM sampling run off the UI process, at a fixed two-second cadence.
let timer = DispatchSource.makeTimerSource(queue: .main)
timer.schedule(deadline: .now(), repeating: 2)
timer.setEventHandler { sample() }; timer.resume()
RunLoop.main.run()
