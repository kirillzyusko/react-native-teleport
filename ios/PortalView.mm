//
//  PortalView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalView.h"
#import "PortalRegistry.h"

#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNTPortalViewComponentDescriptor.h>

#import "RCTFabricComponentsPlugins.h"

#import <React/RCTSurfaceTouchHandler.h>

#include <atomic>

using namespace facebook::react;

// Global counter for z-ordering of portals - ensures later portals appear on top
// Using atomic for thread safety in React Native Fabric's concurrent architecture
static std::atomic<NSInteger> globalZIndexCounter(0);
// Base z-position high enough to be above normal content
static const CGFloat kBaseZPosition = 1000.0f;
static const CGFloat kZPositionIncrement = 1.0f;

@interface PortalView () <RCTPortalViewViewProtocol>

@property (nonatomic, strong) NSString *hostName;
@property (nonatomic, strong) UIView *targetView;
@property (nonatomic, assign) BOOL isWaitingForHost;
@property (nonatomic, assign) NSInteger portalZIndex;

@end

@implementation PortalView {
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PortalViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PortalViewProps>();
    _props = defaultProps;

    UIView *content = [[UIView alloc] init];
    self.contentView = content;
    self.targetView = content;
    self.portalZIndex = 0;
  }

  return self;
}

- (void)moveChildrenToTarget:(UIView *)source target:(UIView *)target
{
  NSArray<UIView *> *children = [source.subviews copy];
  for (UIView *child in children) {
    [child removeFromSuperview];
  }
  NSInteger i = 0;
  for (UIView *child in children) {
    [target insertSubview:child atIndex:i++];
    // Apply z-position for proper stacking order of nested portals
    if (target != self.contentView) {
      child.layer.zPosition = kBaseZPosition + (self.portalZIndex * kZPositionIncrement);
      [target bringSubviewToFront:child];
    } else {
      // Reset zPosition when moving back to contentView
      child.layer.zPosition = 0;
    }
  }
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<PortalViewProps const>(props);

  std::string newHostStr = newViewProps.hostName;
  NSString *newHostName =
      newHostStr.empty() ? nil : [NSString stringWithUTF8String:newHostStr.c_str()];

  std::string newNameStr = newViewProps.name;

  if (![self.hostName isEqualToString:newHostName]) {
    if (self.isWaitingForHost && self.hostName) {
      [[PortalRegistry sharedInstance] unregisterPendingPortal:self withHostName:self.hostName];
      self.isWaitingForHost = NO;
    }

    self.hostName = newHostName;

    // Assign a new z-index when teleport to a host
    // Using atomic fetch_add for thread safety
    self.portalZIndex = (newHostName != nil) ? globalZIndexCounter.fetch_add(1) + 1 : 0;

    PortalHostView *hostView = nil;
    if (self.hostName) {
      hostView = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
    }

    UIView *newTarget = self.contentView;
    if (self.hostName) {
      if (hostView) {
        newTarget = (UIView *)hostView;
      } else {
        [[PortalRegistry sharedInstance] registerPendingPortal:self withHostName:self.hostName];
        self.isWaitingForHost = YES;
        newTarget = self.contentView;
      }
    }

    if (newTarget != self.targetView) {
      UIView *oldTarget = self.targetView;
      self.targetView = newTarget;

      [self moveChildrenToTarget:oldTarget target:newTarget];
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                          index:(NSInteger)index
{
  [self.targetView insertSubview:childComponentView atIndex:index];
  // Apply z-position for proper stacking order of nested portals
  if (self.targetView != self.contentView) {
    childComponentView.layer.zPosition = kBaseZPosition + (self.portalZIndex * kZPositionIncrement);
    [self.targetView bringSubviewToFront:childComponentView];
  }
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  // Reset zPosition before removing to prevent stale values in recycled views
  childComponentView.layer.zPosition = 0;
  [childComponentView removeFromSuperview];
}

- (void)onHostAvailable
{
  self.isWaitingForHost = NO;

  // Assign a new z-index when host becomes available
  // Using atomic fetch_add for thread safety
  self.portalZIndex = globalZIndexCounter.fetch_add(1) + 1;

  PortalHostView *hostView = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
  if (hostView) {
    [self moveChildrenToTarget:self.contentView target:(UIView *)hostView];
    self.targetView = (UIView *)hostView;
  }
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  if (self.isWaitingForHost && self.hostName) {
    [[PortalRegistry sharedInstance] unregisterPendingPortal:self withHostName:self.hostName];
    self.isWaitingForHost = NO;
  }

  // Reset zPosition on all contentView children to prevent stale values in recycled views
  for (UIView *child in self.contentView.subviews) {
    child.layer.zPosition = 0;
  }

  // Reset portal state for clean recycling
  self.portalZIndex = 0;
  self.targetView = self.contentView;
  self.hostName = nil;
}

// MARK: touch handling
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  BOOL canReceiveTouchEvents = ([self isUserInteractionEnabled] && ![self isHidden]);
  if (!canReceiveTouchEvents) {
    return nil;
  }

  // `hitSubview` is the topmost subview which was hit. The hit point can
  // be outside the bounds of `view` (e.g., if -clipsToBounds is NO).
  UIView *hitSubview = nil;
  BOOL isPointInside = [self pointInside:point withEvent:event];
  if (![self clipsToBounds] || isPointInside) {
    // The default behaviour of UIKit is that if a view does not contain a point,
    // then no subviews will be returned from hit testing, even if they contain
    // the hit point. By doing hit testing directly on the subviews, we bypass
    // the strict containment policy (i.e., UIKit guarantees that every ancestor
    // of the hit view will return YES from -pointInside:withEvent:). See:
    //  - https://developer.apple.com/library/ios/qa/qa2013/qa1812.html
    for (UIView *subview in [_targetView.subviews reverseObjectEnumerator]) {
      // Prevent circular hit-testing by checking if we're in the subview's hierarchy
      if ([self isDescendantOfView:subview]) {
        // Skip views that contain us to prevent cycles
        continue;
      }

      CGPoint convertedPoint = [subview convertPoint:point fromView:self];
      hitSubview = [subview hitTest:convertedPoint withEvent:event];
      if (hitSubview != nil) {
        break;
      }
    }
  }
  return hitSubview;
}

Class<RCTComponentViewProtocol> PortalViewCls(void)
{
  return PortalView.class;
}

@end
