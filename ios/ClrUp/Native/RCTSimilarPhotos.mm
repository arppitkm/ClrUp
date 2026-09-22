#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see SimilarPhotosProvider.swift
 * for the actual bucketing/Vision/quality-ranking pipeline.
 */
@interface RCTSimilarPhotos : NSObject <NativeSimilarPhotosSpec>
@end

@implementation RCTSimilarPhotos {
  SimilarPhotosProvider *_provider;
}

RCT_EXPORT_MODULE(SimilarPhotos)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [SimilarPhotosProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)scanSimilarPhotos:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [_provider scanSimilarPhotosWithCompletion:^(NSArray *groups, NSError *error) {
    if (groups) {
      resolve(groups);
    } else {
      reject(@"similar_photos_scan_failed", error.localizedDescription ?: @"Could not scan for similar photos.", error);
    }
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSimilarPhotosSpecJSI>(params);
}

@end
