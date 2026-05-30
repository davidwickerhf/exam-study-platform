# src/model_evaluation.py
import numpy as np
import matplotlib.pyplot as plt
from itertools import product
from sklearn.metrics import confusion_matrix, accuracy_score, recall_score, f1_score

def plot_confusion_matrix(y_true_int, y_pred_int, classes, normalize=False,
                          title='Confusion matrix', cmap=plt.cm.Blues):
    """
    Plot a confusion matrix for multi-class classification.

    Args:
        y_true_int: true labels as integers (e.g., [7, 2, 1, ...]).
        y_pred_int: predicted labels as integers.
        classes: list of class names (e.g., ["0","1",...,"9"]).
        normalize: if True, normalize rows to show per-class percentages.

    Notes:
        - The diagonal shows correct predictions.
        - Off-diagonal entries show which classes are being confused.
    """
    cm = confusion_matrix(y_true_int, y_pred_int)
    if normalize:
        cm = cm.astype('float') / cm.sum(axis=1, keepdims=True)

    plt.imshow(cm, interpolation='nearest', cmap=cmap)
    plt.title(title)
    plt.colorbar()

    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes, rotation=45)
    plt.yticks(tick_marks, classes)

    fmt = '.2f' if normalize else 'd'
    thresh = cm.max() / 2.
    for i, j in product(range(cm.shape[0]), range(cm.shape[1])):
        plt.text(j, i, format(cm[i, j], fmt),
                 horizontalalignment="center",
                 color="white" if cm[i, j] > thresh else "black")

    plt.tick_params(axis='both', which='both', length=0)

    ax = plt.gca()
    ax.set_xticks(np.arange(cm.shape[1] + 1) - 0.5, minor=True)
    ax.set_yticks(np.arange(cm.shape[0] + 1) - 0.5, minor=True)
    ax.grid(which="minor", color="black", linestyle="--", linewidth=0.2)
    ax.tick_params(which="minor", size=0)

    for spine in ax.spines.values():
        spine.set_edgecolor('black')
        spine.set_linewidth(2)

    plt.tight_layout()
    plt.ylabel('True label')
    plt.xlabel('Predicted label')
    

def compute_metrics(y_true_int, y_pred_int, average: str = "macro", compute_f1: bool = False,
    compute_recall: bool = False):
    """
    Compute a minimal set of classification metrics.

    Args:
        y_true_int: true labels as integers.
        y_pred_int: predicted labels as integers.
        average: averaging mode for multi-class metrics:
            - "macro": average over classes equally
            - "weighted": weighted by support (better if classes are imbalanced).
        compute_f1: if True, compute F1-score.
        compute_recall: if True, compute recall.

    Returns:
        dict with accuracy, and optionally f1 and recall.
    """
    metrics = {}
    metrics["accuracy"] = accuracy_score(y_true_int, y_pred_int)

    if compute_f1:
        metrics["f1"] = f1_score(y_true_int, y_pred_int, average=average)

    if compute_recall:
        metrics["recall"] = recall_score(y_true_int, y_pred_int, average=average)

    return metrics


import os
def compute_model_size_reduction(fp32_path, int8_path):
    """
    Compare model file sizes before and after quantization.
    Args:
        fp32_path: path to the floating-point model weights.
        int8_path: path to the quantized model weights. 

    Returns:
        dict with original size, quantized size, and reduction percentage.
    """

    def bytes_to_mib(n):
        # MiB = 1024^2 bytes 
        return n / (1024**2)

    fp32_size = os.path.getsize(fp32_path)
    int8_size = os.path.getsize(int8_path)

    reduction = 100.0 * (1.0 - (int8_size / max(fp32_size, 1)))

    print(f"FP32 file size: {bytes_to_mib(fp32_size):.2f} MiB")
    print(f"INT8 file size: {bytes_to_mib(int8_size):.2f} MiB")
    print(f"Size reduction: {reduction:.1f}%")

    return {
        "fp32_bytes": fp32_size,
        "int8_bytes": int8_size,
        "reduction_percent": reduction
    }
