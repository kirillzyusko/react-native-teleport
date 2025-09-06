//
//  PortalRegistry.h
//  Pods
//
//  Created by Kiryl Ziusko on 04/09/2025.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@class PortalHostView;

@interface PortalRegistry : NSObject

+ (instancetype)sharedInstance;

- (void)registerHost:(PortalHostView *)host withName:(NSString *)name;
- (void)unregisterHostWithName:(NSString *)name;
- (nullable PortalHostView *)getHostWithName:(NSString *)name;

@end

NS_ASSUME_NONNULL_END
