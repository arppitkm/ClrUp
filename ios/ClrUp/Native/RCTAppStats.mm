#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see AppStatsProvider.swift
 * for the actual UserDefaults-backed persistence.
 */
@interface RCTAppStats : NSObject <NativeAppStatsSpec>
@end

@implementation RCTAppStats {
  AppStatsProvider *_provider;
}

RCT_EXPORT_MODULE(AppStats)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [AppStatsProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getLifetimeFreedBytes:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider lifetimeFreedBytes]);
}

- (void)addLifetimeFreedBytes:(double)bytes
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider addFreedBytes:@(bytes)]);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppStatsSpecJSI>(params);
}

@end
