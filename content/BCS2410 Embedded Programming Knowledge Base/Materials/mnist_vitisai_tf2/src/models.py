# src/models.py
import tensorflow as tf
from tensorflow.keras.layers import Input, Dense, Flatten
from tensorflow.keras.models import Model

def MLP(input_shape, N_classes):
    """
    A simple baseline model (Multi-Layer Perceptron) for MNIST.
    Args:
        input_shape: e.g., (28, 28, 1)
        N_classes: number of output classes (MNIST -> 10)

    Returns:
        tf.keras.Model
    """

    inputs = Input(shape=input_shape)

    x = Flatten()(inputs)                 #flatten turns the 2D image into a 1D vector (28*28 = 784) 
    x = Dense(500, activation="relu")(x)  #fc1 + ReLU
    outputs = Dense(N_classes, activation="softmax")(x)       # fc2 + softmax

    model = Model(inputs, outputs, name="MLP")

    return model





from keras.layers import Conv2D, BatchNormalization, ReLU, GlobalAveragePooling2D, Dense

def custom_CNN(input_shape, N_classes):
    """
    A small CNN for MNIST. 
    Args:
        input_shape: e.g., (28, 28, 1)
        N_classes: number of output classes (MNIST -> 10)

    Returns:
        tf.keras.Model
        
    Design choices:
    - Strided convolutions downsample the feature maps (instead of MaxPooling)
    - BatchNorm + ReLU is a common "Conv block" pattern
    - GlobalAveragePooling replaces Flatten + large Dense layers to reduce the number of parameters
    """
    img_input = tf.keras.Input(shape=input_shape)

    x = Conv2D(16, 5, strides=2, padding="same")(img_input)
    x = BatchNormalization()(x); x = ReLU()(x)

    x = Conv2D(32, 5, strides=2, padding="same")(x)
    x = BatchNormalization()(x); x = ReLU()(x)

    x = Conv2D(64, 3, strides=2, padding="same")(x)
    x = BatchNormalization()(x); x = ReLU()(x)

    x = GlobalAveragePooling2D()(x)
    outputs = Dense(N_classes, activation="softmax")(x)

    return Model(img_input, outputs)
