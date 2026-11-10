//
//  PortalView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalView.h"
#import "PortalHostView.h"
#import "PortalRegistry.h"
#import "PortalStackContainer.h"

#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNTPortalViewComponentDescriptor.h>
#import <react/renderer/components/TeleportViewSpec/RNTPortalViewShadowNode.h>

#import <React/RCTFabricComponentsPlugins.h>

#import <React/RCTSurfaceTouchHandler.h>

using namespace facebook::react;

@implementation RNTPortalStackContainer
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  if (!self.userInteractionEnabled || self.hidden || self.alpha < 0.01)
    return nil;
  for (UIView *child in [self.subviews reverseObjectEnumerator]) {
    UIView *hit = [child hitTest:[child convertPoint:point fromView:self] withEvent:event];
    if (hit)
      return hit;
  }
  return nil;
}
@end

@interface PortalView () <RCTPortalViewViewProtocol>

@property (nonatomic, strong) NSString *hostName;
@property (nonatomic, strong) UIView *targetView;
@property (nonatomic, assign) NSInteger stackOrder;
@property (nonatomic, assign) NSInteger mountOrder;
@property (nonatomic, strong) RNTPortalStackContainer *stackContainer;

@end

@implementation PortalView {
  NSMutableArray<UIView *> *_ownChildren;
  PortalViewShadowNode::ConcreteState::Shared _state;
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
    _ownChildren = [NSMutableArray array];
  }

  return self;
}

- (CGRect)screenRectForView:(UIView *)view
{
  if (!view.window) {
    return CGRectNull;
  }

  return [view convertRect:view.bounds toCoordinateSpace:view.window.screen.coordinateSpace];
}

- (void)resetPortalLayoutStateIfNeeded
{
  if (!_state) {
    return;
  }

  PortalViewState newData = {};
  _state->updateState(
      [=](const PortalViewShadowNode::ConcreteState::Data &oldData)
          -> PortalViewShadowNode::ConcreteState::SharedData {
        if (oldData.hostWidth == newData.hostWidth && oldData.hostHeight == newData.hostHeight &&
            oldData.offsetX == newData.offsetX && oldData.offsetY == newData.offsetY) {
          return nullptr;
        }

        return std::make_shared<const PortalViewShadowNode::ConcreteState::Data>(newData);
      });
}

- (void)updatePortalLayoutStateIfNeeded
{
  if (!_state) {
    return;
  }

  if (!self.hostName || ![[PortalRegistry sharedInstance] getHostWithName:self.hostName]) {
    [self resetPortalLayoutStateIfNeeded];
    return;
  }

  CGRect sourceRect = [self screenRectForView:self];
  CGRect hostRect = [self screenRectForView:self.targetView];

  if (CGRectIsNull(sourceRect) || CGRectIsNull(hostRect)) {
    return;
  }

  // Children are physically mounted under a group in the host, but measured through this
  // PortalView shadow node. Store the host's native layout so Fabric
  // measurement follows the destination after it re-layouts.
  CGSize hostSize = self.targetView.bounds.size;

  PortalViewState newData = {
      static_cast<Float>(hostSize.width),
      static_cast<Float>(hostSize.height),
      static_cast<Float>(hostRect.origin.x - sourceRect.origin.x),
      static_cast<Float>(hostRect.origin.y - sourceRect.origin.y)};

  _state->updateState(
      [=](const PortalViewShadowNode::ConcreteState::Data &oldData)
          -> PortalViewShadowNode::ConcreteState::SharedData {
        if (oldData.hostWidth == newData.hostWidth && oldData.hostHeight == newData.hostHeight &&
            oldData.offsetX == newData.offsetX && oldData.offsetY == newData.offsetY) {
          return nullptr;
        }

        return std::make_shared<const PortalViewShadowNode::ConcreteState::Data>(newData);
      });
}

- (void)moveOwnChildrenToTarget:(UIView *)target
{
  NSArray<UIView *> *children = [_ownChildren copy];
  for (UIView *child in children) {
    [child removeFromSuperview];
  }

  for (UIView *child in children) {
    [target addSubview:child];
  }
}

- (UIView *)targetForHost:(PortalHostView *)host
{
  if (!host) {
    [self.stackContainer removeFromSuperview];
    return self.contentView;
  }
  if (!self.stackContainer) {
    self.stackContainer = [[RNTPortalStackContainer alloc] init];
    self.stackContainer.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  }
  UIView *container = host.portalContainer;
  self.stackContainer.frame = container.bounds;
  self.stackContainer.stackOrder = self.stackOrder == INT32_MIN ? 0 : self.stackOrder;
  self.stackContainer.mountOrder = self.mountOrder;
  self.stackContainer.layer.zPosition = self.stackContainer.stackOrder;
  if (self.stackContainer.superview != container) {
    [self.stackContainer removeFromSuperview];
    NSInteger index = [host nextInsertionIndexForChildAt:0];
    [container insertSubview:self.stackContainer atIndex:index];
  }
  [host sortPortals];
  return self.stackContainer;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<PortalViewProps const>(props);

  self.stackOrder = newViewProps.stackOrder;
  self.mountOrder = newViewProps.mountOrder;
  PortalHostView *currentHost = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
  if (currentHost)
    [self targetForHost:currentHost];

  std::string newHostStr = newViewProps.hostName;
  NSString *newHostName =
      newHostStr.empty() ? nil : [NSString stringWithUTF8String:newHostStr.c_str()];

  std::string newNameStr = newViewProps.name;

  if (![self.hostName isEqualToString:newHostName]) {
    if (self.hostName) {
      [[PortalRegistry sharedInstance] unregisterPendingPortal:self withHostName:self.hostName];
    }

    self.hostName = newHostName;

    PortalHostView *hostView = nil;
    if (self.hostName) {
      hostView = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
    }

    UIView *newTarget = [self targetForHost:hostView];

    if (newTarget != self.targetView) {
      self.targetView = newTarget;

      [self moveOwnChildrenToTarget:newTarget];
    }

    if (self.hostName) {
      [[PortalRegistry sharedInstance] registerPendingPortal:self withHostName:self.hostName];
    }
  }

  [super updateProps:props oldProps:oldProps];
  [self updatePortalLayoutStateIfNeeded];
}

/// Finds the host index of the first next sibling (in _ownChildren) that is
/// already present in the host.  Returns -1 when none is found (caller should append).
- (NSInteger)findNextSiblingHostIndex:(NSInteger)ownIndex
{
  for (NSInteger i = ownIndex + 1; i < (NSInteger)_ownChildren.count; i++) {
    UIView *sibling = _ownChildren[i];
    NSInteger siblingIdx = [self.targetView.subviews indexOfObject:sibling];
    if (siblingIdx != NSNotFound) {
      return (NSInteger)siblingIdx;
    }
  }
  return -1;
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                          index:(NSInteger)index
{
  [_ownChildren insertObject:childComponentView atIndex:MIN(index, (NSInteger)_ownChildren.count)];

  if (self.targetView == self.contentView) {
    // when adding to self, preserve the React tree order with the provided index
    [self.targetView insertSubview:childComponentView atIndex:index];
  } else {
    NSInteger ownIndex = [_ownChildren indexOfObject:childComponentView];
    NSInteger hostIndex = [self findNextSiblingHostIndex:ownIndex];
    if (hostIndex >= 0) {
      [self.targetView insertSubview:childComponentView atIndex:hostIndex];
    } else {
      [self.targetView addSubview:childComponentView];
    }
  }
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [_ownChildren removeObject:childComponentView];
  [childComponentView removeFromSuperview];
}

- (void)onHostChanged
{
  PortalHostView *hostView = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
  UIView *newTarget = [self targetForHost:hostView];

  if (newTarget != self.targetView) {
    self.targetView = newTarget;
    [self moveOwnChildrenToTarget:newTarget];
  }

  if (!hostView) {
    [self resetPortalLayoutStateIfNeeded];
  } else {
    [self updatePortalLayoutStateIfNeeded];
  }
}

- (void)dealloc
{
  [self.stackContainer removeFromSuperview];
}

- (void)onHostLayoutChanged
{
  PortalHostView *host = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
  if (host)
    [self targetForHost:host];
  [self updatePortalLayoutStateIfNeeded];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self updatePortalLayoutStateIfNeeded];
}

- (void)updateState:(const facebook::react::State::Shared &)state
           oldState:(const facebook::react::State::Shared &)oldState
{
  _state = std::static_pointer_cast<const PortalViewShadowNode::ConcreteState>(state);
  [self updatePortalLayoutStateIfNeeded];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  if (self.hostName) {
    [[PortalRegistry sharedInstance] unregisterPendingPortal:self withHostName:self.hostName];
  }

  // Reset all portal state so recycled views don't retain stale host references.
  // Without this, a recycled PortalView's targetView still points to the old host,
  // causing mountChildComponentView to add children to the wrong host and
  // moveOwnChildrenToTarget to operate on a stale source.
  self.hostName = nil;
  [self.stackContainer removeFromSuperview];
  self.stackContainer = nil;
  self.targetView = self.contentView;
  [_ownChildren removeAllObjects];
  _state.reset();
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
    NSArray<UIView *> *orderedSubviews =
        [_targetView.subviews sortedArrayWithOptions:NSSortStable
                                     usingComparator:^NSComparisonResult(UIView *a, UIView *b) {
                                       if (a.layer.zPosition < b.layer.zPosition)
                                         return NSOrderedAscending;
                                       if (a.layer.zPosition > b.layer.zPosition)
                                         return NSOrderedDescending;
                                       return NSOrderedSame;
                                     }];
    for (UIView *subview in [orderedSubviews reverseObjectEnumerator]) {
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
