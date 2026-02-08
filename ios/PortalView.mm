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

using namespace facebook::react;

@interface PortalView () <RCTPortalViewViewProtocol>

@property (nonatomic, strong) NSString *hostName;
@property (nonatomic, strong) UIView *targetView;
@property (nonatomic, assign) BOOL isWaitingForHost;

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
  }

  return self;
}

- (void)moveChildrenToTarget:(UIView *)source target:(UIView *)target
{
  NSArray<UIView *> *children = [source.subviews copy];
  for (UIView *child in children) {
    [child removeFromSuperview];
  }
  for (UIView *child in children) {
    [target addSubview:child];
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
  if (self.targetView == self.contentView) {
    // when adding to self, preserve the React tree order with the provided index
    [self.targetView insertSubview:childComponentView atIndex:index];
  } else {
    // when adding to a different container (host), append to the
    [self.targetView addSubview:childComponentView];
  }
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [childComponentView removeFromSuperview];
}

- (void)onHostAvailable
{
  self.isWaitingForHost = NO;

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
