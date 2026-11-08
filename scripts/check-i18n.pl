# Lists t() / tn() texts in js/*.js that have no French, and French keys found in two files. Usage (Git Bash, repo root):
#   perl scripts/check-i18n.pl js
# The French texts are split by area in js/fr/*.js (merged by js/i18n-fr.js): a key must be in one file only, or the
# later file would silently override the earlier one. Exits 1 when a key is missing French or is duplicated.
local $/;
my $dir = shift;
my $str = qr/"((?:[^"\x5c]|\x5c.)*)"/;
my (%d, $bad);
for my $f (glob "$dir/fr/*.js") { open F, $f or die; my $s = <F>;
  while ($s =~ /^\s*$str:/mg) { if ($d{$1}) { print "duplicate French key in $f and $d{$1}: $1\n"; $bad = 1 } $d{$1} = $f }
}
print scalar(keys %d), " keys\n";
for my $f (glob "$dir/*.js") { next if $f =~ /i18n/; open G, $f; my $c = <G>;
  while ($c =~ /\bt\($str/g) { unless ($d{$1}) { print "$f: $1\n"; $bad = 1 } }
  while ($c =~ /\btn\([^,]+,\s*$str,\s*$str/g) { for ($1, $2) { unless ($d{$_}) { print "$f: $_\n"; $bad = 1 } } }
}
exit($bad ? 1 : 0);
