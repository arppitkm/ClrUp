#import "ClrUpSpecs/ClrUpSpecs.h"

// See RCTDeviceStorage.mm for why this import is needed the first time a
// translation unit pulls in the Swift bridging header.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ClrUp-Swift.h"

/**
 * TurboModule registration + JS bridging only — see
 * ContactsDuplicatesProvider.swift for the actual detection/merge/delete logic.
 */
@interface RCTContactsDuplicates : NSObject <NativeContactsDuplicatesSpec>
@end

@implementation RCTContactsDuplicates {
  ContactsDuplicatesProvider *_provider;
}

RCT_EXPORT_MODULE(ContactsDuplicates)

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [ContactsDuplicatesProvider new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)scanDuplicateContacts:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve([_provider scanDuplicates]);
}

- (void)mergeContacts:(NSString *)primaryId
          duplicateIds:(NSArray *)duplicateIds
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_provider mergeContactsWithPrimaryId:primaryId
                            duplicateIds:duplicateIds
                              completion:^(NSError *error) {
    if (error) {
      reject(@"merge_contacts_failed", error.localizedDescription ?: @"Could not merge contacts.", error);
    } else {
      resolve(nil);
    }
  }];
}

- (void)deleteContacts:(NSArray *)ids
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [_provider deleteContactsWithIds:ids
                          completion:^(NSError *error) {
    if (error) {
      reject(@"delete_contacts_failed", error.localizedDescription ?: @"Could not delete contacts.", error);
    } else {
      resolve(nil);
    }
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeContactsDuplicatesSpecJSI>(params);
}

@end
