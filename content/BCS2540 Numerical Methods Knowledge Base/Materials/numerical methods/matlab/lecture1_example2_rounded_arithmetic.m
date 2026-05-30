% Problem:  Evaluate polynomial in single and double precision
% Topic:    Computer Arithmetic (1) / Slide 35/76
% Author:   M. Boussé
% Version:  29/03/2022

wipe; 

format long % Always do this in this course! (You can set a startup file.)

%% Evaluate polynomial in double precision arithmetic

c = [1.00, -5.34, 1.52, 4.61];
x = 4.89;
fx = polyval(c,x)

%% Evaluate polynomial in single precision arithmetic

sc = single(c);
sx = single(x);
sfx = polyval(sc,sx)

%% Compute error

aerr = abs(double(sfx)-fx)
rerr = aerr/abs(fx)

%% using fprintf you can specifiy number of sf (see help for other formats)

fprintf('absolute error %.2g \n',aerr)
fprintf('relative error %.2g \n',rerr)