
MIXED TEST DATASET — Rice Paddy Disease Classification
=======================================================
Shaon Khan | IIT, Jahangirnagar University

Total Images : 100
Classes      : Bacterial, Fungal, Normal, Others, Viral
Source       : Validation set (model never seen these)

Folder Structure:
-----------------
mixed_test_dataset/
├── Bacterial/     (20 images)
├── Fungal/        (20 images)
├── Normal/        (20 images)
├── Others/        (20 images)
├── Viral/         (20 images)
└── true_labels.csv  (ground truth for accuracy check)

How to test:
------------
1. Load your model
2. Give any image from any folder
3. Check prediction vs folder name (= true label)
4. Use true_labels.csv for batch accuracy check
