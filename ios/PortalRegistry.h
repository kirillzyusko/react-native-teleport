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
@class PortalView;
@class MirrorView;

@interface PortalRegistry : NSObject

+ (instancetype)sharedInstance;

- (void)registerHost:(PortalHostView *)host withName:(NSString *)name;
- (void)unregisterHostWithName:(NSString *)name viewTag:(NSInteger)viewTag;
- (nullable PortalHostView *)getHostWithName:(NSString *)name;
- (void)notifyHostLayoutChangedWithName:(NSString *)name;

- (void)registerPendingPortal:(PortalView *)portal withHostName:(NSString *)hostName;
- (void)unregisterPendingPortal:(PortalView *)portal withHostName:(NSString *)hostName;

- (void)registerPortalSource:(UIView *)source withName:(NSString *)name;
- (void)unregisterPortalSourceWithName:(NSString *)name viewTag:(NSInteger)viewTag;
- (void)unregisterPortalSourceWithName:(NSString *)name source:(UIView *)source;
- (nullable UIView *)getPortalSourceWithName:(NSString *)name;
- (void)notifyMirrorsForPortalSourceName:(NSString *)name;

- (void)registerPendingMirror:(MirrorView *)mirror withName:(NSString *)name;
- (void)unregisterPendingMirror:(MirrorView *)mirror withName:(NSString *)name;

@end

NS_ASSUME_NONNULL_END
