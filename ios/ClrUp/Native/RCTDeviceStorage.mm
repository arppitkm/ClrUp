#import "ClrUpSpecs/ClrUpSpecs.h"

// ClrUp-Swift.h forward-declares AppDelegate's ReactNativeDelegate, whose
// superclass lives here — without this import that reference fails to
// resolve when this file is the first to pull in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only. All real logic lives in
 * `DeviceStorageProvider.swift` — this file's job is exactly the plumbing
 * codegen expects (protocol conformance, module name, promise resolution).
 */
@interface RCTDeviceStorage : NSObject <NativeDeviceStorageSpec>
@end

@implementation RCTDeviceStorage {
  DeviceStorageProvider *_provider;
}

RCT_EXPORT_MODULE(DeviceStorage)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [DeviceStorageProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getDeviceStorage:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  NSDictionary<NSString *, NSNumber *> *snapshot = [_provider snapshotAndReturnError:&error];

  if (snapshot == nil) {
    reject(@"device_storage_unavailable", error.localizedDescription ?: @"Could not read device storage.", error);
    return;
  }

  resolve(snapshot);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeDeviceStorageSpecJSI>(params);
}

@end
