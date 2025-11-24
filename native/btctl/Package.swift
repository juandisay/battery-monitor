// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "btctl",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "btctl", targets: ["btctl"])
    ],
    targets: [
        .executableTarget(
            name: "btctl",
            path: "Sources/btctl"
        )
    ]
)
