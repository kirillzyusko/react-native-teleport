//
//  PortalHostView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalHostView.h"
#import "PortalRegistry.h"
#import "PortalStackContainer.h"

#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNTPortalHostViewComponentDescriptor.h>

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTSurfaceTouchHandler.h>

using namespace facebook::react;

// Fabric sorts siblings within each source Portal, not across unrelated Portals.
// Match Core Animation's visual order when hit-testing their shared destination.
static UIView *RNTHitTestPortalChildren(UIView *container, CGPoint point, UIEvent *event)
{
  if (!container.userInteractionEnabled || container.hidden || container.alpha < 0.01)
    return nil;
  if (container.clipsToBounds && ![container pointInside:point withEvent:event])
    return nil;
  NSArray<UIView *> *children =
      [container.subviews sortedArrayWithOptions:NSSortStable
                                 usingComparator:^NSComparisonResult(UIView *a, UIView *b) {
                                   if (a.layer.zPosition < b.layer.zPosition)
                                     return NSOrderedAscending;
                                   if (a.layer.zPosition > b.layer.zPosition)
                                     return NSOrderedDescending;
                                   return NSOrderedSame;
                                 }];
  for (UIView *child in [children reverseObjectEnumerator]) {
    UIView *hit = [child hitTest:[child convertPoint:point fromView:container] withEvent:event];
    if (hit)
      return hit;
  }
  return nil;
}

@interface RNTFullScreenContainer : RCTViewComponentView
// Weakly captures the anchor so a surface-owned destination cannot retain it.
@property (nonatomic, copy) void (^onLayout)(void);
@end

@implementation RNTFullScreenContainer
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  return RNTHitTestPortalChildren(self, point, event);
}
- (void)layoutSubviews
{
  [super layoutSubviews];
  if (self.onLayout) {
    self.onLayout();
  }
}
@end

@interface PortalHostView () <RCTPortalHostViewViewProtocol>

@property (nonatomic, strong) NSString *registeredName;
@property (nonatomic, assign) BOOL isInBatch;
@property (nonatomic, assign) NSInteger batchBaseIndex;
@property (nonatomic, assign) BOOL fullScreen;
@property (nonatomic, strong) RNTFullScreenContainer *fullScreenContainer;

@end

@implementation PortalHostView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PortalHostViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PortalHostViewProps>();
    _props = defaultProps;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<PortalHostViewProps const>(props);

  if (self.fullScreen != newViewProps.fullScreen) {
    self.fullScreen = newViewProps.fullScreen;
    [self updateFullScreenContainer];
  }

  std::string nameStr = newViewProps.name;
  NSString *newName = nameStr.empty() ? nil : [NSString stringWithUTF8String:nameStr.c_str()];

  if (![self.registeredName isEqualToString:newName]) {
    if (self.registeredName) {
      [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
    }
    self.registeredName = newName;
    if (newName) {
      [[PortalRegistry sharedInstance] registerHost:self withName:newName];
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self updateFullScreenContainer];

  if (self.registeredName) {
    [[PortalRegistry sharedInstance] notifyHostLayoutChangedWithName:self.registeredName];
  }
}

- (NSInteger)nextInsertionIndexForChildAt:(NSInteger)childIndex
{
  if (!self.isInBatch) {
    self.isInBatch = YES;
    self.batchBaseIndex = (NSInteger)self.portalContainer.subviews.count;
    __weak PortalHostView *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      weakSelf.isInBatch = NO;
    });
  }
  return MIN(self.batchBaseIndex + childIndex, (NSInteger)self.portalContainer.subviews.count);
}

- (UIView *)portalContainer
{
  // The Fabric anchor can have screen-local bounds. Portals must insert and
  // measure against the physical destination, which may fill the entire surface.
  return self.fullScreenContainer ?: self;
}

- (void)sortPortals
{
  NSPredicate *predicate =
      [NSPredicate predicateWithBlock:^BOOL(UIView *view, NSDictionary *bindings) {
        return [view isKindOfClass:[RNTPortalStackContainer class]];
      }];
  NSArray<RNTPortalStackContainer *> *groups =
      [[self.portalContainer.subviews filteredArrayUsingPredicate:predicate]
          sortedArrayWithOptions:NSSortStable
                 usingComparator:^NSComparisonResult(
                     RNTPortalStackContainer *a, RNTPortalStackContainer *b) {
                   if (a.stackOrder != b.stackOrder)
                     return a.stackOrder < b.stackOrder ? NSOrderedAscending : NSOrderedDescending;
                   if (a.mountOrder != b.mountOrder)
                     return a.mountOrder < b.mountOrder ? NSOrderedAscending : NSOrderedDescending;
                   return NSOrderedSame;
                 }];
  // A layout pass should not reorder an already-correct hierarchy. Apart from
  // unnecessary work, hierarchy mutations complicate native transition handling.
  NSArray<UIView *> *currentSubviews = self.portalContainer.subviews;
  NSUInteger start = currentSubviews.count - groups.count;
  BOOL alreadyOrdered = YES;
  for (NSUInteger index = 0; index < groups.count; index++) {
    if (currentSubviews[start + index] != groups[index]) {
      alreadyOrdered = NO;
      break;
    }
  }
  if (alreadyOrdered)
    return;
  for (UIView *group in groups)
    [self.portalContainer bringSubviewToFront:group];
}

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  return RNTHitTestPortalChildren(self, point, event);
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [self updateFullScreenContainer];
}

- (void)updateFullScreenContainer
{
  if (!self.fullScreen || !self.window) {
    [self removeFullScreenContainer];
    return;
  }

  // Stay in the current React surface: native presentations remain above us.
  // Its touch handler also dispatches events for the relocated content.
  // Do not attach to UIWindow or the top presented controller: that would change
  // modal ordering and require a separate touch-dispatch lifecycle.
  UIView *surface = nil;
  for (UIView *ancestor = self.superview; ancestor; ancestor = ancestor.superview) {
    for (UIGestureRecognizer *recognizer in ancestor.gestureRecognizers) {
      if ([recognizer isKindOfClass:[RCTSurfaceTouchHandler class]]) {
        surface = ancestor;
      }
    }
  }
  if (!surface) {
    return;
  }
  if (!self.fullScreenContainer) {
    RNTFullScreenContainer *container =
        [[RNTFullScreenContainer alloc] initWithFrame:surface.bounds];
    container.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    __weak PortalHostView *weakSelf = self;
    container.onLayout = ^{
      PortalHostView *host = weakSelf;
      if (host.registeredName) {
        [[PortalRegistry sharedInstance] notifyHostLayoutChangedWithName:host.registeredName];
      }
    };
    self.fullScreenContainer = container;
    [surface addSubview:container];
    // Retarget portals before moving any declarative host children.
    if (self.registeredName) {
      [[PortalRegistry sharedInstance] notifySubscribersForName:self.registeredName];
    }
    for (UIView *child in [self.subviews copy]) {
      [container addSubview:child];
    }
  } else if (self.fullScreenContainer.superview != surface) {
    [self.fullScreenContainer removeFromSuperview];
    [surface addSubview:self.fullScreenContainer];
  }
  self.fullScreenContainer.frame = surface.bounds;
}

- (void)removeFullScreenContainer
{
  RNTFullScreenContainer *container = self.fullScreenContainer;
  if (!container) {
    return;
  }
  self.fullScreenContainer = nil;
  // Clear the destination first: subscriber callbacks must resolve back to the
  // anchor rather than reattaching their groups to the container being removed.
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] notifySubscribersForName:self.registeredName];
  }
  for (UIView *child in [container.subviews copy]) {
    [self addSubview:child];
  }
  container.onLayout = nil;
  [container removeFromSuperview];
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index
{
  if (self.fullScreenContainer) {
    [self.fullScreenContainer insertSubview:child
                                    atIndex:MIN(index, self.fullScreenContainer.subviews.count)];
  } else {
    [super mountChildComponentView:child index:index];
  }
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index
{
  if (self.fullScreenContainer) {
    [child removeFromSuperview];
  } else {
    [super unmountChildComponentView:child index:index];
  }
}

- (void)prepareForRecycle
{
  self.fullScreen = NO;
  [self removeFullScreenContainer];
  [super prepareForRecycle];

  self.isInBatch = NO;
  self.batchBaseIndex = 0;

  // Unregister before recycling so a stale registeredName doesn't cause
  // this view to unregister a DIFFERENT host's entry when it's reused
  // with a new name.
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
    self.registeredName = nil;
  }
}

- (void)dealloc
{
  self.fullScreenContainer.onLayout = nil;
  [self.fullScreenContainer removeFromSuperview];
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName viewTag:self.tag];
  }
}

Class<RCTComponentViewProtocol> PortalHostViewCls(void)
{
  return PortalHostView.class;
}

@end
