//
//  MirrorView.h
//  Pods
//
//  Created by Kiryl Ziusko on 13/04/2026.
//

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#ifndef MirrorViewNativeComponent_h
#define MirrorViewNativeComponent_h

NS_ASSUME_NONNULL_BEGIN

@interface MirrorView : RCTViewComponentView

- (void)onPortalAvailable;

@end

NS_ASSUME_NONNULL_END

#endif /* MirrorViewNativeComponent_h */
