import { Image, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';

export function ImageViewerModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible && !!uri} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <IconSymbol name="xmark" size={26} color="#fff" />
        </Pressable>
        {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  image: {
    flex: 1,
    width: '100%',
  },
});
