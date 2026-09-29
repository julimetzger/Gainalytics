import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text} from 'react-native-paper';

interface AnalyseErrorBoundaryProps {
  children: React.ReactNode;
  screenName: string;
}

interface AnalyseErrorBoundaryState {
  error: Error | null;
}

/**
 * GH-458 (H1): a render error on ONE Analyse screen used to unmount the whole
 * navigation tree — the user was left on a white screen with no drawer, no
 * header and no way back except the task switcher.
 *
 * The boundary sits INSIDE each drawer screen, below the navigator, so a failing
 * screen degrades to a card while the header and the drawer stay interactive.
 * That is what makes the area recoverable without an app restart.
 */
class AnalyseErrorBoundary extends React.Component<AnalyseErrorBoundaryProps, AnalyseErrorBoundaryState> {
  state: AnalyseErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): AnalyseErrorBoundaryState {
    return {error};
  }

  componentDidCatch(error: Error) {
    console.warn(`[Analyse] ${this.props.screenName} failed to render: ${error.message}`);
  }

  handleRetry = () => {
    this.setState({error: null});
  };

  render() {
    const {error} = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container} testID="analyse-error-boundary">
        <Card style={styles.card}>
          <Card.Title title={`${this.props.screenName} could not be displayed`} titleNumberOfLines={3} />
          <Card.Content>
            <Text testID="analyse-error-boundary-message">
              Something went wrong while building this view. Use the menu to open another Analyse screen, or try again.
            </Text>
            <Button mode="outlined" style={styles.action} onPress={this.handleRetry} testID="analyse-error-boundary-retry">
              Try again
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }
}

/**
 * Wraps a drawer screen component so React Navigation keeps rendering the header
 * and the drawer even when the screen body throws. The navigation props are
 * forwarded untouched.
 */
export const withAnalyseErrorBoundary = <P extends object>(WrappedScreen: React.ComponentType<P>, screenName: string) => {
  const ScreenWithErrorBoundary = (props: P) => (
    <AnalyseErrorBoundary screenName={screenName}>
      <WrappedScreen {...props} />
    </AnalyseErrorBoundary>
  );

  ScreenWithErrorBoundary.displayName = `withAnalyseErrorBoundary(${screenName})`;
  return ScreenWithErrorBoundary;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    margin: 12,
  },
  action: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
});

export default AnalyseErrorBoundary;
