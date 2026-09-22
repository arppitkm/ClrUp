#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see PhotoScannerProvider.swift
 * for the actual Photos enumeration and thumbnail logic.
 */
@interface RCTPhotoScanner : NSObject <NativePhotoScannerSpec>
@end

@implementation RCTPhotoScanner {
  PhotoScannerProvider *_provider;
}

RCT_EXPORT_MODULE(PhotoScanner)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [PhotoScannerProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)getLibrarySummary:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider librarySummary]);
}

- (void)listScreenshots:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider screenshotList]);
}

- (void)listLargeVideos:(double)limit
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider videoListWithLimit:(NSInteger)limit]);
}

- (void)requestThumbnail:(NSString *)assetId
            targetWidthPx:(double)targetWidthPx
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_provider requestThumbnailForAsset:assetId
                            targetWidth:(CGFloat)targetWidthPx
                             completion:^(NSString *uri, NSError *error) {
    if (uri) {
      resolve(uri);
    } else {
      reject(@"thumbnail_failed", error.localizedDescription ?: @"Could not render thumbnail.", error);
    }
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePhotoScannerSpecJSI>(params);
}

@end
