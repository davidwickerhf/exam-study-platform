This folder contains the material for the Vitis AI tutorial.

Folder structure:

mnist_vitisai_tf2/
│
├── README.txt
├── training.ipynb
├── quantization.ipynb
├── src/
│   ├── dataset.py
│   ├── evaluation.py
│   └── models.py
├── results/       (this folder will be generated during execution)
└── compilation/   (this folder will be generated during execution)

Instructions:

Start by following the notebook `training.ipynb`, which performs the model training.

Then proceed with `quantization.ipynb`, where the trained model is quantized and compiled for deployment with Vitis AI.