//
//  MirrorView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 19/05/2026.
//

#import "MirrorView.h"
#import "PortalRegistry.h"

#import <QuartzCore/QuartzCore.h>
#import <objc/message.h>
#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNMirrorViewComponentDescriptor.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface MirrorView () <RCTMirrorViewViewProtocol>

@property (nonatomic, copy, nullable) NSString *registeredName;
@property (nonatomic, weak, nullable) UIView *sourceView;
@property (nonatomic, strong, nullable) UIView *portalView;

@end

@implementation MirrorView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<MirrorViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MirrorViewProps>();
    _props = defaultProps;

    UIView *content = [[UIView alloc] init];
    content.frame = self.bounds;
    content.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    content.userInteractionEnabled = NO;

    self.contentView = content;
    self.userInteractionEnabled = NO;
  }

  return self;
}

- (nullable UIView *)createPortalViewWithFrame:(CGRect)frame
{
  Class portalViewClass = NSClassFromString(@"_UIPortalView");
  if (!portalViewClass || ![portalViewClass isSubclassOfClass:[UIView class]]) {
    return nil;
  }

  SEL sourceSelector = NSSelectorFromString(@"setSourceView:");
  if (![portalViewClass instancesRespondToSelector:sourceSelector]) {
    return nil;
  }

  UIView *portalView = [[portalViewClass alloc] initWithFrame:frame];
  portalView.frame = frame;
  portalView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  portalView.userInteractionEnabled = NO;

  return portalView;
}

- (void)setPortalBool:(BOOL)value
         selectorName:(NSString *)selectorName
           portalView:(UIView *)portalView
{
  SEL selector = NSSelectorFromString(selectorName);
  if ([portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, BOOL))objc_msgSend)(portalView, selector, value);
  }
}

- (void)setSourceView:(nullable UIView *)sourceView onPortalView:(UIView *)portalView
{
  SEL selector = NSSelectorFromString(@"setSourceView:");
  if ([portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, UIView *))objc_msgSend)(portalView, selector, sourceView);
  }

  SEL updateSelector = NSSelectorFromString(@"_updateSourceLayer");
  if ([portalView respondsToSelector:updateSelector]) {
    ((void (*)(id, SEL))objc_msgSend)(portalView, updateSelector);
  }
}

- (void)configurePortalView:(UIView *)portalView
{
  // Mirror has one cross-platform contract. The private UIKit implementation
  // is deliberately kept internal and cannot leak its behavior switches into
  // the public React Native API.
  [self setPortalBool:NO selectorName:@"setHidesSourceView:" portalView:portalView];
  [self setPortalBool:NO selectorName:@"setMatchesAlpha:" portalView:portalView];
  [self setPortalBool:NO selectorName:@"setMatchesTransform:" portalView:portalView];
  [self setPortalBool:NO selectorName:@"setMatchesPosition:" portalView:portalView];
}

- (BOOL)isDrawableSourceView:(UIView *)sourceView
{
  return sourceView && CGRectGetWidth(sourceView.bounds) > 0 &&
      CGRectGetHeight(sourceView.bounds) > 0;
}

- (void)installPortalViewWithSourceView:(UIView *)sourceView
{
  UIView *replacement = [self createPortalViewWithFrame:self.contentView.bounds];
  if (!replacement) {
    return;
  }

  // Configure source visibility semantics before associating the source. The
  // private initWithSourceView: path can transiently apply its default of
  // hiding the source before setHidesSourceView:NO takes effect.
  [self configurePortalView:replacement];
  [self setSourceView:sourceView onPortalView:replacement];

  UIView *previous = self.portalView;

  // Put the replacement above the previous portal first. If UIKit needs a
  // display transaction to prepare the new source layer, the old pixels stay
  // visible underneath instead of exposing an empty frame.
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  [self.contentView addSubview:replacement];
  [replacement setNeedsLayout];
  [replacement layoutIfNeeded];

  __weak MirrorView *weakSelf = self;
  [CATransaction setCompletionBlock:^{
    MirrorView *strongSelf = weakSelf;
    if (strongSelf && previous != strongSelf.portalView) {
      // A transaction completion confirms the layer-tree commit, not that a
      // private portal has necessarily presented its first pixels. Keep the
      // previous portal underneath for two display frames as a transparent
      // fallback while the replacement becomes drawable.
      dispatch_after(
          dispatch_time(DISPATCH_TIME_NOW, (int64_t)(32 * NSEC_PER_MSEC)),
          dispatch_get_main_queue(),
          ^{
            MirrorView *currentSelf = weakSelf;
            if (!currentSelf || previous != currentSelf.portalView) {
              [previous removeFromSuperview];
            }
          });
    }
  }];

  self.portalView = replacement;
  self.sourceView = sourceView;
  [CATransaction commit];
}

- (void)clearCurrentSource
{
  if (self.portalView) {
    [self setSourceView:nil onPortalView:self.portalView];
  }
  self.sourceView = nil;
}

- (void)removeAllPortalViews
{
  Class portalViewClass = NSClassFromString(@"_UIPortalView");
  for (UIView *subview in [self.contentView.subviews copy]) {
    if (portalViewClass && [subview isKindOfClass:portalViewClass]) {
      [self setSourceView:nil onPortalView:subview];
      [subview removeFromSuperview];
    }
  }
  self.portalView = nil;
}

- (void)refreshSource
{
  if (!self.registeredName) {
    [self clearCurrentSource];
    return;
  }

  UIView *sourceView =
      [[PortalRegistry sharedInstance] getPortalSourceWithName:self.registeredName];
  if (![self isDrawableSourceView:sourceView]) {
    [self clearCurrentSource];
    return;
  }

  if (sourceView == self.sourceView && self.portalView) {
    return;
  }

  [self installPortalViewWithSourceView:sourceView];
}

- (void)onSourceChanged
{
  [self refreshSource];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];

  if (self.window) {
    [self refreshSource];
  }
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  self.contentView.frame = self.bounds;
  self.portalView.frame = self.contentView.bounds;
}

- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics
           oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics
{
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  self.contentView.frame = self.bounds;
  self.portalView.frame = self.contentView.bounds;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<MirrorViewProps const>(props);

  std::string newNameStr = newViewProps.name;
  NSString *newName = newNameStr.empty() ? nil : [NSString stringWithUTF8String:newNameStr.c_str()];

  if (![self.registeredName isEqualToString:newName]) {
    if (self.registeredName) {
      [[PortalRegistry sharedInstance] unregisterPendingMirror:self withName:self.registeredName];
    }

    self.registeredName = newName;

    if (newName) {
      [[PortalRegistry sharedInstance] registerPendingMirror:self withName:newName];
    }

    [self refreshSource];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterPendingMirror:self withName:self.registeredName];
  }

  [self clearCurrentSource];
  [self removeAllPortalViews];
  self.registeredName = nil;
}

- (void)dealloc
{
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterPendingMirror:self withName:self.registeredName];
  }
}

Class<RCTComponentViewProtocol> MirrorViewCls(void)
{
  return MirrorView.class;
}

@end
