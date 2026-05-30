# src/dataset.py
import os
# Silence TensorFlow messages
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
import tensorflow as tf
from tensorflow.keras import datasets
from sklearn.model_selection import train_test_split


def load_mnist(
    limit_test: int = 5000,
    normalize: bool = True,
    add_channel_dim: bool = True,
    one_hot: bool = True,
):
    """
    Load MNIST and apply basic preprocessing.
    
    MNIST images are 28x28 grayscale digits:
      - x_* initially has shape (N, 28, 28) and dtype uint8 in [0, 255]
      - y_* initially has shape (N,) with integer labels in {0,...,9}

    Args:
        limit_test: optionally keep only the first N test samples (faster evaluation in class).
        normalize: if True, scale pixels to [0,1] and cast to float32 (recommended for NN training).
        add_channel_dim: if True, reshape to (N, 28, 28, 1) to match Conv2D input format.
        one_hot: if True, convert integer labels to one-hot vectors (needed for some losses).

    Returns:
        (x_train, y_train), (x_test, y_test)
    """

    # MNIST dataset has 70k images. Training set is 60k, test set is 10k.
    # Each image is 28x28(x8bits).  #e.g., x_train=(N, h, w) with h,w=28
    (x_train, y_train), (x_test, y_test) = datasets.mnist.load_data()

    if normalize:
        # Normalization: scale image data from range 0-255 to range 0-1
        # Also converts train & test data to float32 from uint8 
        x_train = (x_train / 255.0).astype(np.float32)
        x_test = (x_test / 255.0).astype(np.float32)

    if limit_test is not None:
        #test dataset reduced to first 5000 images to simplify evaluation
        x_test = x_test[:limit_test]
        y_test = y_test[:limit_test]

    if add_channel_dim:
        # reshape: add channel dimension to match Conv2D input format: from (batch, 28, 28) → (batch, 28, 28, 1)
        # tensorFlow expects (batch, height, width, channels)
        h, w = x_train.shape[1:]
        x_train = x_train.reshape(x_train.shape[0], h, w, 1)
        x_test = x_test.reshape(x_test.shape[0], h, w, 1)

    if one_hot:
        #one-hot encode the labels
        y_train = tf.keras.utils.to_categorical(y_train)
        y_test = tf.keras.utils.to_categorical(y_test)

    return (x_train, y_train), (x_test, y_test)


def split_train_val(
    x_train,
    y_train,
    val_size=10000,
    random_state: int = 42,
    stratify: bool = True,
):
    """
    Split the training set into train and validation subsets.
    

    This function works with:
      - one-hot labels (shape: (N, num_classes))
      - integer labels (shape: (N,))

    Args:
        x_train: training images.
        y_train: training labels (one-hot or integers).
        val_size: number of samples to allocate to the validation set.
        random_state: fixed seed for reproducibility.
        stratify: if True, keep the same class distribution in train/val.

    Returns:
        x_train, x_val, y_train, y_val
    """
    y_for_strat = None
    if stratify:
        if getattr(y_train, "ndim", 1) > 1:  # one-hot
            y_for_strat = np.argmax(y_train, axis=1)
        else:
            y_for_strat = y_train

    x_tr, x_val, y_tr, y_val = train_test_split(
        x_train,
        y_train,
        test_size=val_size,
        random_state=random_state,
        stratify=y_for_strat,
    )
    return x_tr, x_val, y_tr, y_val
