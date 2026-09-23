import os
import copy
import time
import io
import urllib.request

import numpy as np
import pandas as pd
import cv2
import matplotlib.pyplot as plt
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models

from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity


device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

CLASS_NAMES = ['Bacterial', 'Fungal', 'Viral', 'Normal']


def classify_folder(folder_name):
    f = folder_name.lower().replace(' ', '').replace('_', '').replace('-', '')

    if any(k in f for k in ['bacterial', 'panicle', 'streak']):
        return 0
    elif any(k in f for k in ['blast', 'brown', 'smut', 'scald', 'sheath', 'mildew', 'narrowbrown']):
        return 1
    elif 'tungro' in f:
        return 2
    elif any(k in f for k in ['normal', 'healthy']):
        return 3
    return None


def build_dataset():
    datasets_roots = [
        '/kaggle/input/datasets/deepikabantu22/paddy-disease-classification',
        '/kaggle/input/datasets/nirmalsankalana/rice-leaf-disease-image',
        '/kaggle/input/datasets/raihan150146/rice-leaf-diseases-dataset',
        '/kaggle/input/datasets/vbookshelf/rice-leaf-diseases',
        '/kaggle/input/datasets/minhhuy2810/rice-diseases-image-dataset',
    ]

    records = []
    for root in datasets_roots:
        for dirpath, _, filenames in os.walk(root):
            if 'test_images' in dirpath:
                continue
            class_id = classify_folder(os.path.basename(dirpath))
            if class_id is not None:
                for f in filenames:
                    if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                        records.append({'image_path': os.path.join(dirpath, f), 'label': class_id})

    raw_df = pd.DataFrame(records).drop_duplicates(subset=['image_path'])

    max_samples = 2000
    balanced_dfs = []
    for cid in range(4):
        cdf = raw_df[raw_df['label'] == cid]
        if len(cdf) > max_samples:
            balanced_dfs.append(cdf.sample(n=max_samples, random_state=42))
        else:
            balanced_dfs.append(cdf)

    df = pd.concat(balanced_dfs).sample(frac=1, random_state=42).reset_index(drop=True)
    train_df, val_df = train_test_split(df, test_size=0.2, stratify=df['label'], random_state=42)
    return df, train_df, val_df


class PathogenDataset(Dataset):
    def __init__(self, dataframe, transform=None):
        self.dataframe = dataframe.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.dataframe)

    def __getitem__(self, idx):
        path = self.dataframe.iloc[idx]['image_path']
        label = self.dataframe.iloc[idx]['label']
        image = Image.open(path).convert('RGB')
        if self.transform:
            image = self.transform(image)
        return image, torch.tensor(label, dtype=torch.long)


train_transforms = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.RandomRotation(20),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

val_transforms = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def train_eval_model(model, name, train_loader, val_loader, epochs=5):
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    scaler = torch.amp.GradScaler('cuda')

    best_acc = 0.0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        r_loss, r_corrects, train_total = 0.0, 0, 0
        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            with torch.amp.autocast('cuda'):
                outputs = model(inputs)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            _, preds = torch.max(outputs, 1)
            r_loss += loss.item() * inputs.size(0)
            r_corrects += torch.sum(preds == labels.data).item()
            train_total += labels.size(0)

        scheduler.step()
        train_acc = r_corrects / train_total

        model.eval()
        v_loss, v_corrects, val_total = 0.0, 0, 0
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                with torch.amp.autocast('cuda'):
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)

                _, preds = torch.max(outputs, 1)
                v_loss += loss.item() * inputs.size(0)
                v_corrects += torch.sum(preds == labels.data).item()
                val_total += labels.size(0)

        val_acc = v_corrects / val_total
        print(f"[{name}] Epoch {epoch+1}/{epochs} - Train Acc: {train_acc*100:.2f}% | Val Acc: {val_acc*100:.2f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), f"/kaggle/working/best_stage2_{name}.pth")

    total_time = (time.time() - start_time) / 60
    print(f"[{name}] Finished: Best Val Acc = {best_acc*100:.2f}% in {total_time:.2f} mins\n")
    return best_acc


class FocalLoss(nn.Module):
    def __init__(self, alpha=None, gamma=2.0, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none', weight=self.alpha)
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss

        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        return focal_loss


class RiceLeafDataset(Dataset):
    def __init__(self, df, transform=None):
        self.paths = df['image_path'].values
        if 'pathogen_id' in df.columns:
            self.labels = df['pathogen_id'].values
        elif 'label' in df.columns:
            self.labels = df['label'].values
        else:
            self.labels = df.iloc[:, 1].values
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert('RGB')
        label = self.labels[idx]
        if self.transform:
            img = self.transform(img)
        return img, label


train_transforms_384 = transforms.Compose([
    transforms.RandomResizedCrop(384, scale=(0.6, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.2),
    transforms.RandomRotation(degrees=20),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

val_transforms_384 = transforms.Compose([
    transforms.Resize((384, 384)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def finetune_focal(model, name, train_loader_384, val_loader_384, train_labels, epochs=5):
    from sklearn.utils.class_weight import compute_class_weight

    model = model.to(device)

    unique_classes = np.unique(train_labels)
    weights = compute_class_weight(class_weight='balanced', classes=unique_classes, y=train_labels)
    class_weights_tensor = torch.tensor(weights, dtype=torch.float).to(device)

    criterion = FocalLoss(alpha=class_weights_tensor, gamma=2.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-5, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    scaler = torch.amp.GradScaler('cuda')

    best_acc = 0.0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for inputs, labels in train_loader_384:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            with torch.amp.autocast('cuda'):
                outputs = model(inputs)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            _, preds = torch.max(outputs, 1)
            train_loss += loss.item() * inputs.size(0)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)

        scheduler.step()
        train_acc = train_correct / train_total

        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for inputs, labels in val_loader_384:
                inputs, labels = inputs.to(device), labels.to(device)
                with torch.amp.autocast('cuda'):
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)

                _, preds = torch.max(outputs, 1)
                val_loss += loss.item() * inputs.size(0)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        val_acc = val_correct / val_total
        print(f"[{name}] Epoch {epoch+1}/{epochs} | Train Acc: {train_acc*100:.2f}% | Val Acc: {val_acc*100:.2f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), f"/kaggle/working/best_focal_384_{name}.pth")

    print(f"Training completed in {(time.time() - start_time)/60:.2f} mins. Best Val Acc: {best_acc*100:.2f}%\n")
    return best_acc


def boost_bacterial_finetune(model, name, train_loader_384, epochs=3):
    model.train()
    bacterial_weights = torch.tensor([1.8, 1.0, 1.0, 1.0], dtype=torch.float).to(device)
    criterion = FocalLoss(alpha=bacterial_weights, gamma=2.5)

    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-5, weight_decay=1e-2)
    scaler = torch.amp.GradScaler('cuda')

    print("Starting bacterial boost fine-tuning...")
    for epoch in range(epochs):
        train_loss, train_correct, train_total = 0.0, 0, 0
        for inputs, labels in train_loader_384:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            with torch.amp.autocast('cuda'):
                outputs = model(inputs)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            _, preds = torch.max(outputs, 1)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)

        print(f"Boost epoch {epoch+1}/{epochs} | Acc: {train_correct/train_total*100:.2f}%")

    torch.save(model.state_dict(), f"/kaggle/working/best_bacterial_boost_{name}.pth")
    print("Bacterial boost fine-tuning completed and weights saved.")
    return model


def bacterial_priority_tuning(convnext_model, train_loader_384, epochs=2):
    strong_bact_weights = torch.tensor([3.0, 1.0, 1.0, 1.0], dtype=torch.float).to(device)
    criterion_bact = FocalLoss(alpha=strong_bact_weights, gamma=2.5)

    optimizer = torch.optim.AdamW(convnext_model.parameters(), lr=1e-5, weight_decay=1e-2)

    convnext_model.train()
    for epoch in range(epochs):
        for inputs, labels in train_loader_384:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            with torch.amp.autocast('cuda'):
                outputs = convnext_model(inputs)
                loss = criterion_bact(outputs, labels)
            loss.backward()
            optimizer.step()
        print(f"Bacterial priority tuning epoch {epoch+1}/{epochs} done")

    torch.save(convnext_model.state_dict(), '/kaggle/working/best_focal_384_convnext_tiny.pth')
    return convnext_model


class ConvNeXtFeatureExtractor(nn.Module):
    def __init__(self, base_model):
        super().__init__()
        self.features = base_model.features
        self.avgpool = nn.AdaptiveAvgPool2d(1)

    def forward(self, x):
        x = self.features(x)
        x = self.avgpool(x)
        return torch.flatten(x, 1)


def build_reference_gallery(feature_extractor, ref_df, ref_transforms, embed_dim=768):
    ref_embeddings = []
    with torch.no_grad():
        for path in ref_df['image_path']:
            try:
                img = Image.open(path).convert('RGB')
                tensor = ref_transforms(img).unsqueeze(0).to(device)
                with torch.amp.autocast('cuda'):
                    feat = feature_extractor(tensor)
                feat = feat / torch.norm(feat, p=2, dim=1, keepdim=True)
                ref_embeddings.append(feat.cpu().numpy()[0])
            except Exception:
                ref_embeddings.append(np.zeros(embed_dim))
    return np.array(ref_embeddings)


class PaddyDataset(Dataset):
    def __init__(self, df, transform=None):
        target_col = None
        for candidate in ['label', 'target', 'pathogen_id', 'class_id', 'label_idx']:
            if candidate in df.columns:
                target_col = candidate
                break
        if target_col is None:
            raise ValueError("No recognizable target column in dataframe.")

        path_col = 'image_path' if 'image_path' in df.columns else df.columns[0]
        self.paths = df[path_col].values
        self.targets = df[target_col].values
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert('RGB')
        label = int(self.targets[idx])
        if self.transform:
            img = self.transform(img)
        return img, label


def fresh_balanced_finetune(train_df, val_df, epochs=5):
    train_loader_384 = DataLoader(
        PaddyDataset(train_df, transform=train_transforms_384),
        batch_size=16, shuffle=True, num_workers=2,
    )
    val_loader_384 = DataLoader(
        PaddyDataset(val_df, transform=val_transforms_384),
        batch_size=16, shuffle=False, num_workers=2,
    )

    model = models.convnext_tiny(weights='DEFAULT')
    num_ftrs = model.classifier[2].in_features
    model.classifier[2] = nn.Linear(num_ftrs, 4)
    model = model.to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    params = [
        {'params': model.features.parameters(), 'lr': 1e-5},
        {'params': model.classifier.parameters(), 'lr': 1e-4},
    ]
    optimizer = torch.optim.AdamW(params, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    scaler = torch.amp.GradScaler('cuda')

    best_val_acc = 0.0
    best_model_wts = copy.deepcopy(model.state_dict())

    for epoch in range(epochs):
        start_time = time.time()

        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for inputs, labels in train_loader_384:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            with torch.amp.autocast('cuda'):
                outputs = model(inputs)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            _, preds = torch.max(outputs, 1)
            train_loss += loss.item() * inputs.size(0)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)

        scheduler.step()
        epoch_train_loss = train_loss / train_total
        epoch_train_acc = train_correct / train_total * 100

        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for inputs, labels in val_loader_384:
                inputs, labels = inputs.to(device), labels.to(device)
                with torch.amp.autocast('cuda'):
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)

                _, preds = torch.max(outputs, 1)
                val_loss += loss.item() * inputs.size(0)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        epoch_val_loss = val_loss / val_total
        epoch_val_acc = val_correct / val_total * 100
        elapsed = time.time() - start_time

        print(f"Epoch {epoch+1:02d}/{epochs:02d} [{elapsed:.0f}s] | "
              f"Train Loss: {epoch_train_loss:.4f} - Acc: {epoch_train_acc:.2f}% | "
              f"Val Loss: {epoch_val_loss:.4f} - Acc: {epoch_val_acc:.2f}%")

        if epoch_val_acc > best_val_acc:
            best_val_acc = epoch_val_acc
            best_model_wts = copy.deepcopy(model.state_dict())
            torch.save(best_model_wts, '/kaggle/working/best_fresh_balanced_convnext.pth')
            print(f"  >>> Best model saved (Val Acc: {best_val_acc:.2f}%)")

    print(f"Fresh fine-tuning completed. Best accuracy: {best_val_acc:.2f}%")
    return model, best_val_acc


class ConvNeXtGradCAM:
    def __init__(self, target_model, target_layer):
        self.model = target_model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        self.hook_f = self.target_layer.register_forward_hook(self.save_activation)
        self.hook_b = self.target_layer.register_full_backward_hook(self.save_gradient)

    def save_activation(self, module, input, output):
        self.activations = output.detach()

    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def __call__(self, x_tensor, target_class):
        self.model.zero_grad()
        output = self.model(x_tensor)

        one_hot = torch.zeros_like(output)
        one_hot[0][target_class] = 1.0
        output.backward(gradient=one_hot, retain_graph=True)

        gradients = self.gradients.cpu().data.numpy()[0]
        activations = self.activations.cpu().data.numpy()[0]

        weights = np.mean(gradients, axis=(1, 2))
        cam = np.zeros(activations.shape[1:], dtype=np.float32)

        for i, w in enumerate(weights):
            cam += w * activations[i]

        cam = np.maximum(cam, 0)
        if cam.max() > 0:
            cam = cam / cam.max()
        return cv2.resize(cam, (384, 384))

    def remove_hooks(self):
        self.hook_f.remove()
        self.hook_b.remove()


def extract_spots_and_features(cam_mask, original_np):
    mask_binary = np.uint8(cam_mask > 0.45) * 255
    contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    annotated_img = original_np.copy()
    spot_metrics = []
    h_img, w_img, _ = original_np.shape
    total_img_area = h_img * w_img

    for idx, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < 80:
            continue

        perimeter = cv2.arcLength(cnt, True)
        p_a_ratio = perimeter / area if area > 0 else 0

        x, y, w, h = cv2.boundingRect(cnt)
        elongation = max(w / h, h / w) if min(w, h) > 0 else 1.0

        mask_cnt = np.zeros((h_img, w_img), dtype=np.uint8)
        cv2.drawContours(mask_cnt, [cnt], -1, 255, -1)
        mean_val = cv2.mean(original_np, mask=mask_cnt)[:3]
        necrosis_score = 255 - np.mean(mean_val)

        cv2.rectangle(annotated_img, (x, y), (x + w, y + h), (255, 0, 0), 2)
        cv2.putText(annotated_img, f'#{idx+1}', (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

        spot_metrics.append({
            'Spot_ID': idx + 1,
            'Area_Ratio_%': round((area / total_img_area) * 100, 2),
            'Perimeter_to_Area': round(p_a_ratio, 3),
            'Necrosis_Intensity': round(necrosis_score, 1),
            'Elongation': round(elongation, 2),
        })

    return spot_metrics, annotated_img


def run_clean_balanced_diagnostic(img_input, convnext_model, feature_extractor, ref_df, ref_embeddings,
                                   transform=val_transforms_384, top_k=5):
    try:
        if str(img_input).startswith(('http://', 'https://')):
            headers = {'User-Agent': 'Mozilla/5.0'}
            req = urllib.request.Request(img_input, headers=headers)
            with urllib.request.urlopen(req) as resp:
                img_pil = Image.open(io.BytesIO(resp.read())).convert('RGB')
        else:
            img_pil = Image.open(img_input).convert('RGB')
    except Exception as e:
        print(f'Failed to load image: {e}')
        return

    orig_np = np.array(img_pil.resize((384, 384)))
    input_tensor = transform(img_pil).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = convnext_model(input_tensor)
        probs = F.softmax(logits, dim=1).cpu().numpy()[0]

    pred_idx = int(np.argmax(probs))
    confidence = float(probs[pred_idx] * 100)
    pred_label = CLASS_NAMES[pred_idx]

    with torch.no_grad():
        query_feat = feature_extractor(input_tensor)
        query_feat = query_feat / torch.norm(query_feat, p=2, dim=1, keepdim=True)
        query_feat = query_feat.cpu().numpy()

    similarities = cosine_similarity(query_feat, ref_embeddings)[0]
    top_indices = np.argsort(similarities)[::-1][:top_k]

    gradcam = ConvNeXtGradCAM(convnext_model, convnext_model.features[-1])
    tensor_grad = transform(img_pil).unsqueeze(0).to(device)
    tensor_grad.requires_grad_(True)
    cam = gradcam(tensor_grad, pred_idx)
    gradcam.remove_hooks()

    spot_vectors, annotated_leaf = extract_spots_and_features(cam, orig_np)

    fig = plt.figure(figsize=(18, 7))
    gs = fig.add_gridspec(2, 5, hspace=0.35, wspace=0.15)

    ax_inp = fig.add_subplot(gs[0, 0])
    ax_inp.imshow(orig_np)
    ax_inp.set_title(f'Pred: {pred_label}\n({confidence:.1f}%)', fontweight='bold', color='darkgreen')
    ax_inp.axis('off')

    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(orig_np, 0.6, cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB), 0.4, 0)
    ax_cam = fig.add_subplot(gs[0, 1])
    ax_cam.imshow(overlay)
    ax_cam.set_title('Attention Focus')
    ax_cam.axis('off')

    ax_spot = fig.add_subplot(gs[0, 2])
    ax_spot.imshow(annotated_leaf)
    ax_spot.set_title(f'Detected Spots: {len(spot_vectors)}')
    ax_spot.axis('off')

    ax_bar = fig.add_subplot(gs[0, 3:])
    colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71']
    bars = ax_bar.bar(CLASS_NAMES, probs * 100, color=colors)
    ax_bar.set_ylim([0, 100])
    ax_bar.set_ylabel('Probability (%)')
    ax_bar.set_title('Pathogen Class Distribution')
    for b in bars:
        yval = b.get_height()
        ax_bar.text(b.get_x() + b.get_width() / 2, yval + 1, f'{yval:.1f}%', ha='center', va='bottom', fontsize=9)

    for rank, idx in enumerate(top_indices):
        ax_ref = fig.add_subplot(gs[1, rank])
        matched_path = ref_df.iloc[idx]['image_path']
        matched_disease = ref_df.iloc[idx]['disease_name']
        matched_img = Image.open(matched_path).convert('RGB')
        sim_score = similarities[idx] * 100

        ax_ref.imshow(matched_img.resize((384, 384)))
        ax_ref.set_title(f'Match #{rank+1} ({sim_score:.1f}%)\n{matched_disease}', fontsize=9)
        ax_ref.axis('off')

    plt.tight_layout()
    plt.show()

    print('=' * 65)
    print('BALANCED DIAGNOSTIC LOG')
    print('=' * 65)
    print(f'Primary Diagnosis  : {pred_label} ({confidence:.2f}%)')
    print(f'Class Proportions  : {dict(zip(CLASS_NAMES, np.round(probs * 100, 2)))}')
    print(f'Detected Spots     : {len(spot_vectors)}')
    print('=' * 65)


def main():
    df, train_df, val_df = build_dataset()

    train_loader = DataLoader(PathogenDataset(train_df, train_transforms), batch_size=32, shuffle=True,
                               num_workers=4, pin_memory=True)
    val_loader = DataLoader(PathogenDataset(val_df, val_transforms), batch_size=32, shuffle=False,
                             num_workers=4, pin_memory=True)

    effnet = models.efficientnet_b3(weights=models.EfficientNet_B3_Weights.DEFAULT)
    effnet.classifier[1] = nn.Linear(effnet.classifier[1].in_features, 4)
    effnet_acc = train_eval_model(effnet, "efficientnet_b3", train_loader, val_loader, epochs=5)

    convnext = models.convnext_tiny(weights=models.ConvNeXt_Tiny_Weights.DEFAULT)
    convnext.classifier[2] = nn.Linear(convnext.classifier[2].in_features, 4)
    convnext_acc = train_eval_model(convnext, "convnext_tiny", train_loader, val_loader, epochs=5)

    resnet = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    resnet.fc = nn.Linear(resnet.fc.in_features, 4)
    resnet_acc = train_eval_model(resnet, "resnet50", train_loader, val_loader, epochs=5)

    results = {
        "convnext_tiny": (convnext_acc, convnext, "/kaggle/working/best_stage2_convnext_tiny.pth"),
        "efficientnet_b3": (effnet_acc, effnet, "/kaggle/working/best_stage2_efficientnet_b3.pth"),
        "resnet50": (resnet_acc, resnet, "/kaggle/working/best_stage2_resnet50.pth"),
    }
    selected_name = max(results, key=lambda k: results[k][0])
    best_acc, selected_model, weights_path = results[selected_name]
    selected_model.load_state_dict(torch.load(weights_path))
    selected_model.eval()
    print(f"Selected champion model: {selected_name} ({best_acc*100:.2f}%)")

    train_dataset_384 = RiceLeafDataset(train_df, transform=train_transforms_384)
    val_dataset_384 = RiceLeafDataset(val_df, transform=val_transforms_384)
    train_loader_384 = DataLoader(train_dataset_384, batch_size=32, shuffle=True, num_workers=2, pin_memory=True)
    val_loader_384 = DataLoader(val_dataset_384, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)

    finetune_focal(selected_model, selected_name, train_loader_384, val_loader_384,
                   train_dataset_384.labels, epochs=5)

    boost_bacterial_finetune(selected_model, selected_name, train_loader_384, epochs=3)

    if selected_name == "convnext_tiny":
        bacterial_priority_tuning(selected_model, train_loader_384, epochs=2)

    base_path = "/kaggle/input/datasets/deepikabantu22/paddy-disease-classification/train_images"
    if not os.path.exists(base_path):
        base_path = "/kaggle/input/paddy-disease-classification/train_images"

    category_map = {
        "bacterial_leaf_blight": 0, "bacterial_leaf_streak": 0, "bacterial_panicle_blight": 0,
        "blast": 1, "brown_spot": 1, "downy_mildew": 1,
        "tungro": 2,
        "normal": 3,
    }
    data_list = []
    for folder in os.listdir(base_path):
        if folder in category_map:
            folder_path = os.path.join(base_path, folder)
            if os.path.isdir(folder_path):
                p_id = category_map[folder]
                for img_file in os.listdir(folder_path):
                    if img_file.lower().endswith((".jpg", ".jpeg", ".png")):
                        data_list.append({
                            "image_path": os.path.join(folder_path, img_file),
                            "disease_name": folder,
                            "true_pathogen_id": p_id,
                        })
    paddy_df = pd.DataFrame(data_list)

    selected_model.load_state_dict(torch.load(f"/kaggle/working/best_focal_384_{selected_name}.pth"))
    selected_model.eval().to(device)

    feature_extractor = ConvNeXtFeatureExtractor(selected_model).to(device)
    feature_extractor.eval()

    ref_df = paddy_df.sample(n=min(2000, len(paddy_df)), random_state=42).reset_index(drop=True)
    ref_transforms = transforms.Compose([
        transforms.Resize((384, 384)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    ref_embeddings = build_reference_gallery(feature_extractor, ref_df, ref_transforms)

    convnext_model, fresh_val_acc = fresh_balanced_finetune(train_df, val_df, epochs=5)

    sample_url = 'https://highyieldsagro.com/wp-content/uploads/2025/06/Paddy-Bacterial-Leaf-Blight-medium.webp'
    run_clean_balanced_diagnostic(sample_url, convnext_model, feature_extractor, ref_df, ref_embeddings)


if __name__ == "__main__":
    main()
