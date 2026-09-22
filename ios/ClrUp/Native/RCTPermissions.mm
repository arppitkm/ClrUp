#import "ClrUpSpecs/ClrUpSpecs.h"

// ClrUp-Swift.h forward-declares AppDelegate's ReactNativeDelegate, whose
// superclass lives here — without this import that reference fails to
// resolve when this file is the first to pull in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see PermissionsProvider.swift
 * for the actual Photos/Contacts logic.
 */
@interface RCTPermissions : NSObject <NativePermissionsSpec>
@end

@implementation RCTPermissions {
  PermissionsProvider *_provider;
}

RCT_EXPORT_MODULE(Permissions)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [PermissionsProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getPhotosAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider photosStatus]);
}

- (void)requestPhotosAuthorization:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [_provider requestPhotosAuthorizationWithCompletion:^(NSString *status) {
    resolve(status);
  }];
}

- (void)presentLimitedLibraryPicker:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  [_provider presentLimitedLibraryPickerWithCompletion:^{
    resolve(nil);
  }];
}

- (void)getContactsAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                                  reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider contactsStatus]);
}

- (void)requestContactsAuthorization:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  [_provider requestContactsAuthorizationWithCompletion:^(NSString *status) {
    resolve(status);
  }];
}

- (void)openSettings:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [_provider openSettingsWithCompletion:^{
    resolve(nil);
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePermissionsSpecJSI>(params);
}

@end
