import torch, torch.nn as nn, numpy as np, cv2
norm_layer = nn.InstanceNorm2d
class ResidualBlock(nn.Module):
    def __init__(self, f):
        super().__init__()
        self.conv_block = nn.Sequential(nn.ReflectionPad2d(1), nn.Conv2d(f, f, 3), norm_layer(f), nn.ReLU(inplace=True),
                                        nn.ReflectionPad2d(1), nn.Conv2d(f, f, 3), norm_layer(f))
    def forward(self, x): return x + self.conv_block(x)
class Generator(nn.Module):
    def __init__(self, input_nc=3, output_nc=1, n_residual_blocks=3, sigmoid=True):
        super().__init__()
        self.model0 = nn.Sequential(nn.ReflectionPad2d(3), nn.Conv2d(input_nc, 64, 7), norm_layer(64), nn.ReLU(inplace=True))
        m1 = []; i = 64; o = 128
        for _ in range(2):
            m1 += [nn.Conv2d(i, o, 3, stride=2, padding=1), norm_layer(o), nn.ReLU(inplace=True)]; i = o; o = i * 2
        self.model1 = nn.Sequential(*m1)
        self.model2 = nn.Sequential(*[ResidualBlock(i) for _ in range(n_residual_blocks)])
        m3 = []; o = i // 2
        for _ in range(2):
            m3 += [nn.ConvTranspose2d(i, o, 3, stride=2, padding=1, output_padding=1), norm_layer(o), nn.ReLU(inplace=True)]; i = o; o = i // 2
        self.model3 = nn.Sequential(*m3)
        m4 = [nn.ReflectionPad2d(3), nn.Conv2d(64, output_nc, 7)]
        if sigmoid: m4 += [nn.Sigmoid()]
        self.model4 = nn.Sequential(*m4)
    def forward(self, x):
        return self.model4(self.model3(self.model2(self.model1(self.model0(x)))))
_M = {}
MODELS = "/tmp/claude-0/-home-user-torque-orden/5bf21a94-3b78-5c97-aee2-574680a421d4/scratchpad/models/"
def model(name="sk_model.pth"):
    if name not in _M:
        g = Generator(); g.load_state_dict(torch.load(MODELS + name, map_location="cpu")); g.eval(); _M[name] = g
    return _M[name]
def nn_lines(rgb, name="sk_model.pth", long_side=1536):
    h, w = rgb.shape[:2]; s = long_side / max(h, w)
    H, W = int(round(h * s / 8) * 8), int(round(w * s / 8) * 8)
    im = cv2.resize(rgb, (W, H), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    x = torch.from_numpy(im).float().permute(2, 0, 1)[None] / 255.0
    torch.set_num_threads(4)
    with torch.no_grad(): y = model(name)(x)[0, 0].numpy()
    return (y * 255).clip(0, 255).astype(np.uint8)  # white bg, dark lines
