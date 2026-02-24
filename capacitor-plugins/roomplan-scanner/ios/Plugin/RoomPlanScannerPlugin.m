/**
 *  RoomPlanScannerPlugin.m
 *  Objective-C bridge for the Swift Capacitor plugin.
 *  Copy this alongside the .swift file into your Xcode project.
 */

#import <Capacitor/Capacitor.h>

CAP_PLUGIN(RoomPlanScannerPlugin, "RoomPlanScanner",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startScan, CAPPluginReturnPromise);
)
