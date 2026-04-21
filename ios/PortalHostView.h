//
//  PortalHostView.h
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#ifndef PortalHostViewNativeComponent_h
#define PortalHostViewNativeComponent_h

NS_ASSUME_NONNULL_BEGIN

@interface PortalHostView : RCTViewComponentView

/// Returns the index at which a portal child should be inserted.
///
/// Within a single Fabric commit all mutations run synchronously on the main
/// thread.  The first call in a commit records the current subview count as
/// the "base"; subsequent calls in the same commit reuse that base so that
/// bottom-to-top Fabric ordering is compensated by `insertSubview:atIndex:`.
/// A `dispatch_async` resets the flag after the commit finishes.
- (NSInteger)nextInsertionIndexForChildAt:(NSInteger)childIndex;

@end

NS_ASSUME_NONNULL_END

#endif /* PortalHostViewNativeComponent_h */
