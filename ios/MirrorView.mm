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

@property (nonatomic, copy, nullable) NSString *registeredName;
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

    self.portalView = [self createPortalViewWithFrame:content.bounds];
    if (self.portalView) {
      [self configurePortalView];
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

  SEL sourceSelector = NSSelectorFromString(@"setSourceView:");
  if (![portalViewClass instancesRespondToSelector:sourceSelector]) {
    return nil;
  }

  UIView *portalView = [[portalViewClass alloc] initWithFrame:frame];
  portalView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  portalView.userInteractionEnabled = NO;

  return portalView;
}

- (void)configurePortalView
{
  SEL selector = NSSelectorFromString(@"setHidesSourceView:");
  if ([self.portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, BOOL))objc_msgSend)(self.portalView, selector, NO);
  }
}

- (void)setSourceView:(nullable UIView *)sourceView
{
  SEL selector = NSSelectorFromString(@"setSourceView:");
  if ([self.portalView respondsToSelector:selector]) {
    ((void (*)(id, SEL, UIView *))objc_msgSend)(self.portalView, selector, sourceView);
  }
}

- (void)refreshSource
{
  UIView *sourceView =
      [[PortalRegistry sharedInstance] getPortalSourceWithName:self.registeredName];
  [self setSourceView:sourceView];
}

- (void)onSourceChanged
{
  [self refreshSource];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
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

  [self setSourceView:nil];
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
