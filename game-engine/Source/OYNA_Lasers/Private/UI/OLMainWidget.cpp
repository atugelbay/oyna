#include "UI/OLMainWidget.h"

// ShowGameOver is a BlueprintNativeEvent.
// The _Implementation is the C++ fallback; override in Blueprint for visuals.
void UOLMainWidget::ShowGameOver_Implementation()
{
    // Default: no-op — Blueprint subclass handles the UI animation.
}
