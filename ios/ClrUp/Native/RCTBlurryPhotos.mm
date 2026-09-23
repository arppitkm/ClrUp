#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see BlurryPhotosProvider.swift
 * for the actual blur-scoring pipeline.
 */
@interface RCTBlurryPhotos : NSObject <NativeBlurryPhotosSpec>
@end

@implementation RCTBlurryPhotos {
  BlurryPhotosProvider *_provider;
}

RCT_EXPORT_MODULE(BlurryPhotos)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [BlurryPhotosProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)scanBlurryPhotos:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_provider scanBlurryPhotosWithCompletion:^(NSArray *assets, NSError *error) {
    if (assets) {
      resolve(assets);
    } else {
      reject(@"blurry_photos_scan_failed", error.localizedDescription ?: @"Could not scan for blurry photos.", error);
    }
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBlurryPhotosSpecJSI>(params);
}

@end
