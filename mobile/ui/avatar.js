import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

// Store a small JPEG in the existing profile.avatar field. The source photo stays local.
export async function prepareAvatar(asset) {
  let context;
  let image;
  let result;
  try {
    if (!asset?.uri || !Number.isFinite(asset.width) || !Number.isFinite(asset.height) || asset.width < 1 || asset.height < 1) {
      throw new Error('Không đọc được ảnh. Bạn thử chọn một ảnh JPG hoặc PNG khác nhé.');
    }
    if (asset.fileSize > 20 * 1024 * 1024) throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 20 MB.');
    const side = Math.floor(Math.min(asset.width, asset.height));
    context = ImageManipulator.manipulate(asset.uri);
    context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
    context.resize({ width: Math.min(side, 512), height: Math.min(side, 512) });
    image = await context.renderAsync();
    result = await image.saveAsync({ format: SaveFormat.JPEG, compress: .82, base64: true });
    if (!result.base64 || result.base64.length * .75 > 1024 * 1024) throw new Error('Chưa thu nhỏ được ảnh. Vui lòng chọn một ảnh khác.');
    return `data:image/jpeg;base64,${result.base64}`;
  } finally {
    if (Platform.OS === 'web') {
      for (const uri of new Set([asset?.uri, image?.uri, result?.uri])) {
        if (uri?.startsWith('blob:')) globalThis.URL?.revokeObjectURL(uri);
      }
    }
    image?.release?.();
    context?.release?.();
  }
}
