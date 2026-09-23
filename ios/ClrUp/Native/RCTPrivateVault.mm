#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see PrivateVaultProvider.swift
 * for the actual storage, biometric gating, and picker logic.
 */
@interface RCTPrivateVault : NSObject <NativePrivateVaultSpec>
@end

@implementation RCTPrivateVault {
  PrivateVaultProvider *_provider;
}

RCT_EXPORT_MODULE(PrivateVault)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [PrivateVaultProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getPrivateAssetIds:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider privateAssetIds]);
}

- (void)addPrivateAssetIds:(NSArray *)ids
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider addPrivateAssetIds:ids]);
}

- (void)removePrivateAssetIds:(NSArray *)ids
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider removePrivateAssetIds:ids]);
}

- (void)authenticate:(NSString *)reason
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [_provider authenticateWithReason:reason completion:^(BOOL success) {
    resolve(@(success));
  }];
}

- (void)presentAssetPicker:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [_provider presentAssetPickerWithCompletion:^(NSArray *ids, NSError *error) {
    if (ids) {
      resolve(ids);
    } else {
      reject(@"asset_picker_failed", error.localizedDescription ?: @"Could not open picker.", error);
    }
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePrivateVaultSpecJSI>(params);
}

@end
