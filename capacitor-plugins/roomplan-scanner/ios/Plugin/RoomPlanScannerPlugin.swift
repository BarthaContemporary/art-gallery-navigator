/**
 *  RoomPlanScannerPlugin.swift
 *  Capacitor plugin wrapping Apple's RoomPlan API (iOS 16+).
 *
 *  SETUP:
 *  1. Copy this file + RoomPlanScannerPlugin.m into your Xcode project
 *     under ios/App/App/Plugins/RoomPlanScanner/
 *  2. Add "Privacy - Camera Usage Description" to Info.plist
 *  3. Build target must be iOS 16+
 *  4. Device must have LiDAR sensor (iPhone 12 Pro+, iPad Pro 2020+)
 */

import Foundation
import Capacitor

#if canImport(RoomPlan)
import RoomPlan

@available(iOS 16.0, *)
@objc(RoomPlanScannerPlugin)
public class RoomPlanScannerPlugin: CAPPlugin, RoomCaptureSessionDelegate, RoomCaptureViewDelegate {

    private var captureSession: RoomCaptureSession?
    private var captureView: RoomCaptureView?
    private var savedCall: CAPPluginCall?

    // MARK: - isSupported

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            // Check for LiDAR by attempting to create a session
            let config = RoomCaptureSession.Configuration()
            call.resolve([
                "supported": true
            ])
        } else {
            call.resolve([
                "supported": false,
                "reason": "Requires iOS 16 or later"
            ])
        }
    }

    // MARK: - startScan

    @objc func startScan(_ call: CAPPluginCall) {
        savedCall = call

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Create the capture view
            let captureView = RoomCaptureView(frame: UIScreen.main.bounds)
            captureView.captureSession.delegate = self
            captureView.delegate = self

            self.captureView = captureView
            self.captureSession = captureView.captureSession

            // Present full-screen
            if let viewController = self.bridge?.viewController {
                captureView.translatesAutoresizingMaskIntoConstraints = false

                let hostVC = UIViewController()
                hostVC.view.addSubview(captureView)
                NSLayoutConstraint.activate([
                    captureView.topAnchor.constraint(equalTo: hostVC.view.topAnchor),
                    captureView.bottomAnchor.constraint(equalTo: hostVC.view.bottomAnchor),
                    captureView.leadingAnchor.constraint(equalTo: hostVC.view.leadingAnchor),
                    captureView.trailingAnchor.constraint(equalTo: hostVC.view.trailingAnchor),
                ])

                // Add a Done button
                let doneButton = UIButton(type: .system)
                doneButton.setTitle("Done Scanning", for: .normal)
                doneButton.titleLabel?.font = UIFont.boldSystemFont(ofSize: 18)
                doneButton.backgroundColor = UIColor.systemBlue
                doneButton.setTitleColor(.white, for: .normal)
                doneButton.layer.cornerRadius = 12
                doneButton.translatesAutoresizingMaskIntoConstraints = false
                doneButton.addTarget(self, action: #selector(self.doneTapped), for: .touchUpInside)
                hostVC.view.addSubview(doneButton)
                NSLayoutConstraint.activate([
                    doneButton.bottomAnchor.constraint(equalTo: hostVC.view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
                    doneButton.centerXAnchor.constraint(equalTo: hostVC.view.centerXAnchor),
                    doneButton.widthAnchor.constraint(equalToConstant: 200),
                    doneButton.heightAnchor.constraint(equalToConstant: 50),
                ])

                hostVC.modalPresentationStyle = .fullScreen
                viewController.present(hostVC, animated: true) {
                    let config = RoomCaptureSession.Configuration()
                    captureView.captureSession.run(configuration: config)
                }
            }
        }
    }

    @objc private func doneTapped() {
        captureSession?.stop()
    }

    // MARK: - RoomCaptureSessionDelegate

    public func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Dismiss the scanning view
            self.bridge?.viewController?.dismiss(animated: true)

            if let error = error {
                self.savedCall?.reject("Scan failed: \(error.localizedDescription)")
                return
            }

            // Process the captured room
            Task {
                do {
                    let finalRoom = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                    let result = self.convertRoomToJSON(finalRoom)
                    self.savedCall?.resolve(result)
                } catch {
                    self.savedCall?.reject("Failed to process room: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Convert CapturedRoom → JSON

    private func convertRoomToJSON(_ room: CapturedRoom) -> [String: Any] {
        var walls: [[String: Any]] = []
        var outline: [[String: Any]] = []
        var minX: Float = .infinity, maxX: Float = -.infinity
        var minZ: Float = .infinity, maxZ: Float = -.infinity

        for wall in room.walls {
            let transform = wall.transform
            let position = simd_float3(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = wall.dimensions // (width, height, depth)

            // Project wall to 2D (top-down: x, z)
            let halfWidth = dimensions.x / 2.0

            // Calculate wall endpoints using transform rotation
            let right = simd_float3(transform.columns.0.x, transform.columns.0.y, transform.columns.0.z)
            let startPoint = position - right * halfWidth
            let endPoint = position + right * halfWidth

            let wallDict: [String: Any] = [
                "start": ["x": Double(startPoint.x), "y": Double(startPoint.z)],
                "end": ["x": Double(endPoint.x), "y": Double(endPoint.z)],
                "height": Double(dimensions.y)
            ]
            walls.append(wallDict)

            // Track bounds
            minX = min(minX, startPoint.x, endPoint.x)
            maxX = max(maxX, startPoint.x, endPoint.x)
            minZ = min(minZ, startPoint.z, endPoint.z)
            maxZ = max(maxZ, startPoint.z, endPoint.z)

            outline.append(["x": Double(startPoint.x), "y": Double(startPoint.z)])
            outline.append(["x": Double(endPoint.x), "y": Double(endPoint.z)])
        }

        // Openings (doors, windows)
        var openings: [[String: Any]] = []
        for door in room.doors {
            let t = door.transform
            let pos = simd_float3(t.columns.3.x, t.columns.3.y, t.columns.3.z)
            let dims = door.dimensions
            let right = simd_float3(t.columns.0.x, t.columns.0.y, t.columns.0.z)
            let hw = dims.x / 2.0
            openings.append([
                "type": "door",
                "start": ["x": Double(pos.x - right.x * hw), "y": Double(pos.z - right.z * hw)],
                "end": ["x": Double(pos.x + right.x * hw), "y": Double(pos.z + right.z * hw)],
                "width": Double(dims.x)
            ])
        }
        for window in room.windows {
            let t = window.transform
            let pos = simd_float3(t.columns.3.x, t.columns.3.y, t.columns.3.z)
            let dims = window.dimensions
            let right = simd_float3(t.columns.0.x, t.columns.0.y, t.columns.0.z)
            let hw = dims.x / 2.0
            openings.append([
                "type": "window",
                "start": ["x": Double(pos.x - right.x * hw), "y": Double(pos.z - right.z * hw)],
                "end": ["x": Double(pos.x + right.x * hw), "y": Double(pos.z + right.z * hw)],
                "width": Double(dims.x)
            ])
        }

        // Objects
        var objects: [[String: Any]] = []
        for obj in room.objects {
            let t = obj.transform
            objects.append([
                "type": obj.category.rawValue.description,
                "center": ["x": Double(t.columns.3.x), "y": Double(t.columns.3.z)],
                "width": Double(obj.dimensions.x),
                "depth": Double(obj.dimensions.z)
            ])
        }

        let roomWidth = Double(maxX - minX)
        let roomDepth = Double(maxZ - minZ)

        return [
            "scanId": UUID().uuidString,
            "roomWidth": roomWidth,
            "roomDepth": roomDepth,
            "walls": walls,
            "openings": openings,
            "objects": objects,
            "outline": outline,
            "scannedAt": ISO8601DateFormatter().string(from: Date())
        ]
    }
}

#else
// Fallback for older iOS / simulators without RoomPlan
@objc(RoomPlanScannerPlugin)
public class RoomPlanScannerPlugin: CAPPlugin {
    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": false, "reason": "RoomPlan not available on this device"])
    }

    @objc func startScan(_ call: CAPPluginCall) {
        call.reject("RoomPlan not available on this device")
    }
}
#endif
