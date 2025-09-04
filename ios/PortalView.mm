//
//  PortalView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalView.h"
#import "PortalRegistry.h"

#import <react/renderer/components/TeleportViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface PortalView () <RCTPortalViewViewProtocol>

@property (nonatomic, strong) NSString *hostName;
@property (nonatomic, strong) UIView *targetView;

@end

@implementation PortalView

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

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<PortalViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<PortalViewProps const>(props);

    std::string newHostStr = newViewProps.hostName;
    NSString *newHostName = newHostStr.empty() ? nil : [NSString stringWithUTF8String:newHostStr.c_str()];

    std::string newNameStr = newViewProps.name;
    NSString *newName = newNameStr.empty() ? nil : [NSString stringWithUTF8String:newNameStr.c_str()];

    if (![self.hostName isEqualToString:newHostName]) {
        self.hostName = newHostName;

        PortalHostView *hostView = nil;
        if (self.hostName) {
            hostView = [[PortalRegistry sharedInstance] getHostWithName:self.hostName];
        }

        UIView *newTarget = self.contentView;
        if (hostView) {
            newTarget = (UIView *) hostView;
        }

        if (newTarget != self.targetView) {
            UIView *oldTarget = self.targetView;
            self.targetView = newTarget;

            NSArray<UIView *> *children = [oldTarget.subviews copy];
            for (UIView *child in children) {
                [child removeFromSuperview];
            }
            NSInteger i = 0;
            for (UIView *child in children) {
                [newTarget insertSubview:child atIndex:i++];
            }
        }
    }

    if (oldViewProps.name != newViewProps.name) {
        self.accessibilityIdentifier = newName;
    }

    [super updateProps:props oldProps:oldProps];
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index {
    [self.targetView insertSubview:childComponentView atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index {
    [childComponentView removeFromSuperview];
}

Class<RCTComponentViewProtocol> PortalViewCls(void)
{
    return PortalView.class;
}

@end
