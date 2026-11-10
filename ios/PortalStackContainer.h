#import <UIKit/UIKit.h>

/// A native-only stacking unit. Fabric owns its children through the source Portal.
/// The pair (stackOrder, mountOrder) orders whole dialogs, including their backdrops.
@interface RNTPortalStackContainer : UIView
@property (nonatomic, assign) NSInteger stackOrder;
@property (nonatomic, assign) NSInteger mountOrder;
@end
