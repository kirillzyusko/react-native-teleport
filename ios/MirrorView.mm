//
//  MirrorView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 19/05/2026.
//

#import "MirrorView.h"
#import "PortalRegistry.h"

#import <objc/message.h>
#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNMirrorViewComponentDescriptor.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface MirrorView () <RCTMirrorViewViewProtocol>

@property (nonatomic, strong) NSString *registeredName;
@property (nonatomic, strong, nullable) UIView *portalView;
@property (nonatomic, assign) NSInteger refreshGeneration;
@property (nonatomic, assign) CGRect lastBounds;
@property (nonatomic, assign) BOOL hidesSourceView;
@property (nonatomic, assign) BOOL matchesAlpha;
@property (nonatomic, assign) BOOL matchesTransform;
@property (nonatomic, assign) BOOL matchesPosition;

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

    self.portalView = [self createPortalViewWithFrame:content.bounds];
    if (self.portalView) {
      [content addSubview:self.portalView];
    }

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

  UIView *portalView = [[portalViewClass alloc] initWithFrame:frame];
  portalView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  portalView.userInteractionEnabled = NO;

  return portalView;
}

- (nullable UIView *)createPortalViewWithSourceView:(UIView *)sourceView frame:(CGRect)frame
{
  Class portalViewClass = NSClassFromString(@"_UIPortalView");
  if (!portalViewClass || ![portalViewClass isSubclassOfClass:[UIView class]]) {
    return nil;
  }

  UIView *portalView = nil;
  SEL initSelector = NSSelectorFromString(@"initWithSourceView:");
  if ([portalViewClass instancesRespondToSelector:initSelector]) {
    portalView = ((UIView * (*)(id, SEL, UIView *)) objc_msgSend)(
        [portalViewClass alloc], initSelector, sourceView);
  } else {
    portalView = [[portalViewClass alloc] initWithFrame:frame];
  }

  portalView.frame = frame;
  portalView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  portalView.userInteractionEnabled = NO;

  return portalView;
}

- (void)installFreshPortalViewWithSourceView:(UIView *)sourceView
{
  [self.portalView removeFromSuperview];
  self.portalView = [self createPortalViewWithSourceView:sourceView frame:self.bounds];

  if (!self.portalView) {
    return;
  }

  [self.contentView addSubview:self.portalView];
  [self setPortalBool:self.hidesSourceView selectorName:@"setHidesSourceView:"];
  [self setPortalBool:self.matchesAlpha selectorName:@"setMatchesAlpha:"];
  [self setPortalBool:self.matchesTransform selectorName:@"setMatchesTransform:"];
  [self setPortalBool:self.matchesPosition selectorName:@"setMatchesPosition:"];
}

- (void)setSourceView:(nullable UIView *)sourceView
{
  if (!self.portalView) {
    return;
  }

  SEL selector = NSSelectorFromString(@"setSourceView:");
  if ([self.portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, UIView *))objc_msgSend)(self.portalView, selector, sourceView);
  }

  SEL updateSelector = NSSelectorFromString(@"_updateSourceLayer");
  if ([self.portalView respondsToSelector:updateSelector]) {
    ((void (*)(id, SEL))objc_msgSend)(self.portalView, updateSelector);
  }
}

- (void)setPortalBool:(BOOL)value selectorName:(NSString *)selectorName
{
  if (!self.portalView) {
    return;
  }

  SEL selector = NSSelectorFromString(selectorName);
  if ([self.portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, BOOL))objc_msgSend)(self.portalView, selector, value);
  }
}

- (void)refreshSource
{
  NSString *registeredName = [self.registeredName copy];
  self.refreshGeneration += 1;
  NSInteger generation = self.refreshGeneration;

  NSArray<NSNumber *> *delays = @[ @0, @16, @80, @200, @500 ];
  for (NSNumber *delay in delays) {
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay.doubleValue * NSEC_PER_MSEC)),
        dispatch_get_main_queue(),
        ^{
          if (self.refreshGeneration != generation ||
              ![self.registeredName isEqualToString:registeredName]) {
            return;
          }

          UIView *sourceView =
              [[PortalRegistry sharedInstance] getPortalSourceWithName:registeredName];
          if (!sourceView) {
            [self setSourceView:nil];
            return;
          }

          [self installFreshPortalViewWithSourceView:sourceView];
          [self setSourceView:sourceView];
        });
  }
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
  self.portalView.frame = self.bounds;

  if (self.window && !CGRectEqualToRect(self.bounds, self.lastBounds)) {
    self.lastBounds = self.bounds;
    [self refreshSource];
  }
}

- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics
           oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics
{
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  self.contentView.frame = self.bounds;
  self.portalView.frame = self.bounds;

  if (self.window && !CGRectEqualToRect(self.bounds, self.lastBounds)) {
    self.lastBounds = self.bounds;
    [self refreshSource];
  }
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<MirrorViewProps const>(props);

  std::string newNameStr = newViewProps.name;
  NSString *newName = newNameStr.empty() ? nil : [NSString stringWithUTF8String:newNameStr.c_str()];

  self.hidesSourceView = newViewProps.hidesSourceView;
  self.matchesAlpha = newViewProps.matchesAlpha;
  self.matchesTransform = newViewProps.matchesTransform;
  self.matchesPosition = newViewProps.matchesPosition;

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

  [self setPortalBool:self.hidesSourceView selectorName:@"setHidesSourceView:"];
  [self setPortalBool:self.matchesAlpha selectorName:@"setMatchesAlpha:"];
  [self setPortalBool:self.matchesTransform selectorName:@"setMatchesTransform:"];
  [self setPortalBool:self.matchesPosition selectorName:@"setMatchesPosition:"];

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  self.refreshGeneration += 1;

  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterPendingMirror:self withName:self.registeredName];
  }

  [self setSourceView:nil];
  self.registeredName = nil;
}

- (void)dealloc
{
  self.refreshGeneration += 1;

  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterPendingMirror:self withName:self.registeredName];
  }
}

Class<RCTComponentViewProtocol> MirrorViewCls(void)
{
  return MirrorView.class;
}

@end
